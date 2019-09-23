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
import "../../utils/TxFinalization.sol";
import "../../../transactions/PaymentTransactionModel.sol";
import "../../../transactions/outputs/PaymentOutputModel.sol";
import "../../../utils/IsDeposit.sol";
import "../../../utils/UtxoPosLib.sol";
import "../../../framework/PlasmaFramework.sol";

library PaymentStartStandardExit {
    using ExitableTimestamp for ExitableTimestamp.Calculator;
    using IsDeposit for IsDeposit.Predicate;
    using PaymentOutputModel for PaymentOutputModel.Output;
    using UtxoPosLib for UtxoPosLib.UtxoPos;
    using TxFinalization for TxFinalization.Verifier;

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
        uint256 txBlockTimeStamp;
        bytes32 outputId;
        TxFinalization.Verifier finalizationVerifier;
    }

    event ExitStarted(
        address indexed owner,
        uint192 exitId
    );

    /**
     * @notice Function that builds the controller struct
     * @return Controller struct of PaymentStartStandardExit
     */
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

    /**
     * @notice Main logic function to start standard exit
     * @dev emits ExitStarted event on success
     * @param self the controller struct
     * @param exitMap the storage of all standard exit data
     * @param args arguments of start standard exit function from client.
     */
    function run(
        Controller memory self,
        PaymentExitDataModel.StandardExitMap storage exitMap,
        PaymentStandardExitRouterArgs.StartStandardExitArgs memory args
    )
        public
    {
        StartStandardExitData memory data = setupStartStandardExitData(self, args);
        verifyStartStandardExitData(self, data, exitMap);
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
        (, uint256 blockTimestamp) = controller.framework.blocks(utxoPos.blockNum());

        OutputGuardModel.Data memory outputGuardData = OutputGuardModel.Data({
            guard: output.outputGuard,
            outputType: args.outputType,
            preimage: args.outputGuardPreimage
        });

        IOutputGuardHandler outputGuardHandler = controller.outputGuardHandlerRegistry.outputGuardHandlers(args.outputType);

        TxFinalization.Verifier memory finalizationVerifier = TxFinalization.moreVpVerifier(
            controller.framework,
            args.rlpOutputTx,
            utxoPos.txPos(),
            args.outputTxInclusionProof
        );

        bytes32 outputId = isTxDeposit
            ? OutputId.computeDepositOutputId(args.rlpOutputTx, utxoPos.outputIndex(), utxoPos.value)
            : OutputId.computeNormalOutputId(args.rlpOutputTx, utxoPos.outputIndex());

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
            txBlockTimeStamp: blockTimestamp,
            outputId: outputId,
            finalizationVerifier: finalizationVerifier
        });
    }

    function verifyStartStandardExitData(
        Controller memory self,
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

        require(data.finalizationVerifier.isStandardFinalized(), "The transaction must be standard finalized");
        require(exitMap.exits[data.exitId].exitable == false, "Exit already started");

        require(self.framework.isOutputSpent(data.outputId) == false, "Output already spent");
    }

    function saveStandardExitData(
        StartStandardExitData memory data,
        PaymentExitDataModel.StandardExitMap storage exitMap
    )
        private
    {
        exitMap.exits[data.exitId] = PaymentExitDataModel.StandardExit({
            exitable: true,
            utxoPos: uint192(data.utxoPos.value),
            outputId: data.outputId,
            exitTarget: msg.sender,
            amount: data.output.amount,
            bondSize: msg.value
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
