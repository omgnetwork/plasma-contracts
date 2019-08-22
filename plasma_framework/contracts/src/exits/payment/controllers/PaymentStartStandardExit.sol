pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../routers/PaymentStandardExitRouterArgs.sol";
import "../../IOutputGuardParser.sol";
import "../../OutputGuardParserRegistry.sol";
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
        OutputGuardParserRegistry outputGuardParserRegistry;
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
        address outputGuardParser;
        address payable exitTarget;
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
        OutputGuardParserRegistry outputGuardParserRegistry
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
            outputGuardParserRegistry: outputGuardParserRegistry
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

        emit ExitStarted(data.exitTarget, data.exitId);
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
        bytes memory outputGuardData = args.outputType == 0 ? bytes("") : args.outputGuardData;

        address payable exitTarget;
        IOutputGuardParser outputGuardParser;
        if (args.outputType == 0) {
            // output type 0 --> output holding owner address directly
            exitTarget = output.owner();
        } else if (args.outputType != 0) {
            outputGuardParser = controller.outputGuardParserRegistry.outputGuardParsers(args.outputType);
            if (address(outputGuardParser) != address(0)) {
                exitTarget = outputGuardParser.parseExitTarget(outputGuardData);
            }
        }

        return StartStandardExitData({
            controller: controller,
            args: args,
            utxoPos: utxoPos,
            outputTx: outputTx,
            output: output,
            outputGuardParser: address(outputGuardParser),
            exitTarget: exitTarget,
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

        if (data.args.outputType != 0) {
            bytes32 outputGuardFromPreImage = OutputGuard.build(data.args.outputType, data.args.outputGuardData);
            require(data.output.outputGuard == outputGuardFromPreImage, "Output guard data does not match pre-image");
            require(data.outputGuardParser != address(0), "Failed to get the output guard parser for the output type");
        }

        require(data.exitTarget == msg.sender, "Only exit target can start an exit");
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
            exitTarget: data.exitTarget,
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
