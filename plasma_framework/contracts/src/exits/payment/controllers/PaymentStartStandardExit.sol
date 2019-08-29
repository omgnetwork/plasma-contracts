pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../routers/PaymentStandardExitRouterArgs.sol";
import "../../interfaces/IOutputGuardHandler.sol";
import "../../models/OutputGuardModel.sol";
import "../../registries/OutputGuardHandlerRegistry.sol";
import "../../utils/ExitableTimestamp.sol";
import "../../utils/ExitId.sol";
import "../../utils/OutputId.sol";
import "../../utils/OutputGuard.sol";
import "../../../transactions/PaymentTransactionModel.sol";
import "../../../transactions/outputs/PaymentOutputModel.sol";
import "../../../utils/IsDeposit.sol";
import "../../../utils/UtxoPosLib.sol";
import "../../../utils/Merkle.sol";
import "../../../framework/PlasmaFramework.sol";

library PaymentStartStandardExit {
    using ExitableTimestamp for ExitableTimestamp.Calculator;
    using IsDeposit for IsDeposit.Predicate;
    using PaymentOutputModel for PaymentOutputModel.Output;
    using UtxoPosLib for UtxoPosLib.UtxoPos;

    struct Controller {
        IExitProcessor exitProcessor;
        PlasmaFramework framework;
        IsDeposit.Predicate isDeposit;
        ExitableTimestamp.Calculator exitableTimestampCalculator;
        OutputGuardHandlerRegistry outputGuardHandlerRegistry;
    }

    /**
     * @dev data to be passed around startStandardExit helper functions
     */
    struct StartStandardExitData {
        Controller controller;
        PaymentStandardExitRouterArgs.StartStandardExitArgs args;
        UtxoPosLib.UtxoPos utxoPos;
        PaymentTransactionModel.Transaction outputTx;
        PaymentOutputModel.Output output;
        IOutputGuardHandler outputGuardHandler;
        OutputGuardModel.Data outputGuardData;
        uint192 exitId;
        bool isTxDeposit;
        bytes32 txBlockRoot;
        uint256 txBlockTimeStamp;
    }

    event ExitStarted(
        address indexed owner,
        uint192 exitId
    );

    function buildController(
        IExitProcessor exitProcessor,
        PlasmaFramework framework,
        OutputGuardHandlerRegistry outputGuardHandlerRegistry
    )
        public
        view
        returns (Controller memory)
    {
        return Controller({
            exitProcessor: exitProcessor,
            framework: framework,
            isDeposit: IsDeposit.Predicate(framework.CHILD_BLOCK_INTERVAL()),
            exitableTimestampCalculator: ExitableTimestamp.Calculator(framework.minExitPeriod()),
            outputGuardHandlerRegistry: outputGuardHandlerRegistry
        });
    }

    function run(
        Controller memory self,
        PaymentExitDataModel.StandardExitMap storage exitMap,
        PaymentStandardExitRouterArgs.StartStandardExitArgs memory args
    )
        public
    {
        StartStandardExitData memory data = setupStartStandardExitData(self, args);
        verifyStartStandardExitData(data, exitMap);
        saveStandardExitData(data, exitMap);
        enqueueStandardExit(data);

        emit ExitStarted(msg.sender, data.exitId);
    }

    function setupStartStandardExitData(
        Controller memory controller,
        PaymentStandardExitRouterArgs.StartStandardExitArgs memory args
    )
        private
        view
        returns (StartStandardExitData memory)
    {
        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(args.utxoPos);
        PaymentTransactionModel.Transaction memory outputTx = PaymentTransactionModel.decode(args.rlpOutputTx);
        PaymentOutputModel.Output memory output = outputTx.outputs[utxoPos.outputIndex()];
        bool isTxDeposit = controller.isDeposit.test(utxoPos.blockNum());
        uint192 exitId = ExitId.getStandardExitId(isTxDeposit, args.rlpOutputTx, utxoPos);
        (bytes32 root, uint256 blockTimestamp) = controller.framework.blocks(utxoPos.blockNum());

        OutputGuardModel.Data memory outputGuardData = OutputGuardModel.Data({
            guard: output.outputGuard,
            outputType: args.outputType,
            preimage: args.outputGuardPreimage
        });

        IOutputGuardHandler outputGuardHandler = controller.outputGuardHandlerRegistry.outputGuardHandlers(args.outputType);

        return StartStandardExitData({
            controller: controller,
            args: args,
            utxoPos: utxoPos,
            outputTx: outputTx,
            output: output,
            outputGuardHandler: outputGuardHandler,
            outputGuardData: outputGuardData,
            exitId: exitId,
            isTxDeposit: isTxDeposit,
            txBlockRoot: root,
            txBlockTimeStamp: blockTimestamp
        });
    }

    function verifyStartStandardExitData(
        StartStandardExitData memory data,
        PaymentExitDataModel.StandardExitMap storage exitMap
    )
        private
        view
    {
        require(data.output.amount > 0, "Should not exit with amount 0");

        require(address(data.outputGuardHandler) != address(0), "Failed to get the output guard handler for the output type");
        require(data.outputGuardHandler.isValid(data.outputGuardData), "Some of the output guard related information is not valid");
        require(data.outputGuardHandler.getExitTarget(data.outputGuardData) == msg.sender, "Only exit target can start an exit");

        require(exitMap.exits[data.exitId].exitable == false, "Exit already started");

        bytes32 leafData = keccak256(data.args.rlpOutputTx);
        require(
            Merkle.checkMembership(
                leafData, data.utxoPos.txIndex(), data.txBlockRoot, data.args.outputTxInclusionProof
            ),
            "transaction inclusion proof failed"
        );
    }

    function saveStandardExitData(
        StartStandardExitData memory data,
        PaymentExitDataModel.StandardExitMap storage exitMap
    )
        private
    {
        bytes32 outputId = data.isTxDeposit?
            OutputId.computeDepositOutputId(data.args.rlpOutputTx, data.utxoPos.outputIndex(), data.utxoPos.value)
            : OutputId.computeNormalOutputId(data.args.rlpOutputTx, data.utxoPos.outputIndex());

        bytes32 outputTypeAndGuardHash = keccak256(
            abi.encodePacked(data.args.outputType, data.output.outputGuard)
        );

        exitMap.exits[data.exitId] = PaymentExitDataModel.StandardExit({
            exitable: true,
            utxoPos: uint192(data.utxoPos.value),
            outputId: outputId,
            outputTypeAndGuardHash: outputTypeAndGuardHash,
            token: data.output.token,
            exitTarget: msg.sender,
            amount: data.output.amount
        });
    }

    function enqueueStandardExit(StartStandardExitData memory data) private {
        uint64 exitableAt = data.controller.exitableTimestampCalculator.calculate(
            block.timestamp, data.txBlockTimeStamp, data.isTxDeposit
        );

        data.controller.framework.enqueue(
            data.output.token, exitableAt, data.utxoPos.txPos(),
            data.exitId, data.controller.exitProcessor
        );
    }
}
