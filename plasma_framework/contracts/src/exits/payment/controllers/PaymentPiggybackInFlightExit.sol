pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../PaymentInFlightExitModelUtils.sol";
import "../routers/PaymentInFlightExitRouterArgs.sol";
import "../../models/OutputGuardModel.sol";
import "../../interfaces/IOutputGuardHandler.sol";
import "../../registries/OutputGuardHandlerRegistry.sol";
import "../../utils/ExitableTimestamp.sol";
import "../../utils/ExitId.sol";
import "../../utils/OutputGuard.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../framework/interfaces/IExitProcessor.sol";
import "../../../transactions/outputs/PaymentOutputModel.sol";
import "../../../transactions/PaymentTransactionModel.sol";
import "../../../utils/IsDeposit.sol";
import "../../../utils/UtxoPosLib.sol";

library PaymentPiggybackInFlightExit {
    using UtxoPosLib for UtxoPosLib.UtxoPos;
    using IsDeposit for IsDeposit.Predicate;
    using ExitableTimestamp for ExitableTimestamp.Calculator;
    using PaymentInFlightExitModelUtils for PaymentExitDataModel.InFlightExit;
    using PaymentOutputModel for PaymentOutputModel.Output;

    uint8 constant public MAX_INPUT_NUM = 4;
    uint8 constant public MAX_OUTPUT_NUM = 4;

    struct Controller {
        PlasmaFramework framework;
        IsDeposit.Predicate isDeposit;
        ExitableTimestamp.Calculator exitableTimestampCalculator;
        IExitProcessor exitProcessor;
        OutputGuardHandlerRegistry outputGuardHandlerRegistry;
        uint256 minExitPeriod;
    }

    event InFlightExitInputPiggybacked(
        address indexed exitTarget,
        bytes32 txHash,
        uint16 inputIndex
    );

    event InFlightExitOutputPiggybacked(
        address indexed exitTarget,
        bytes32 txHash,
        uint16 outputIndex
    );

    function buildController(
        PlasmaFramework framework,
        IExitProcessor exitProcessor,
        OutputGuardHandlerRegistry outputGuardHandlerRegistry
    )
        public
        view
        returns (Controller memory)
    {
        return Controller({
            framework: framework,
            isDeposit: IsDeposit.Predicate(framework.CHILD_BLOCK_INTERVAL()),
            exitableTimestampCalculator: ExitableTimestamp.Calculator(framework.minExitPeriod()),
            exitProcessor: exitProcessor,
            outputGuardHandlerRegistry: outputGuardHandlerRegistry,
            minExitPeriod: framework.minExitPeriod()
        });
    }

    /**
     * @notice The main controller logic for 'piggybackInFlightExitOnInput'
     * @dev emits InFlightExitInputPiggybacked event if suceed
     * @param self the controller struct
     * @param inFlightExitMap the storage of all in-flight exit data
     * @param args arguments of 'piggybackInFlightExitOnInput' function from client.
     */
    function piggybackInput(
        Controller memory self,
        PaymentExitDataModel.InFlightExitMap storage inFlightExitMap,
        PaymentInFlightExitRouterArgs.PiggybackInFlightExitOnInputArgs memory args
    )
        public
    {
        uint192 exitId = ExitId.getInFlightExitId(args.inFlightTx);
        PaymentExitDataModel.InFlightExit storage exit = inFlightExitMap.exits[exitId];

        require(exit.exitStartTimestamp != 0, "No in-flight exit to piggyback on");
        require(exit.isInFirstPhase(self.minExitPeriod), "Can only piggyback in first phase of exit period");

        require(args.inputIndex < MAX_INPUT_NUM, "Index exceed max size of the input");
        require(!exit.isInputPiggybacked(args.inputIndex), "The indexed input has been piggybacked already");

        PaymentExitDataModel.WithdrawData storage withdrawData = exit.inputs[args.inputIndex];

        // In startInFlightExit, exitTarget for inputs would be saved as those are the neccesarry data to create the transaction
        require(withdrawData.exitTarget == msg.sender, "Can be called by the exit target only");
        withdrawData.piggybackBondSize = msg.value;

        if (exit.isFirstPiggybackOfTheToken(withdrawData.token)) {
            enqueue(self, withdrawData.token, UtxoPosLib.UtxoPos(exit.position), exitId);
        }

        exit.setInputPiggybacked(args.inputIndex);

        emit InFlightExitInputPiggybacked(msg.sender, keccak256(args.inFlightTx), args.inputIndex);
    }

    /**
     * @notice The main controller logic for 'piggybackInFlightExitOnOutput'
     * @dev emits InFlightExitOutputPiggybacked event if suceed
     * @param self the controller struct
     * @param inFlightExitMap the storage of all in-flight exit data
     * @param args arguments of 'piggybackInFlightExitOnOutput' function from client.
     */
    function piggybackOutput(
        Controller memory self,
        PaymentExitDataModel.InFlightExitMap storage inFlightExitMap,
        PaymentInFlightExitRouterArgs.PiggybackInFlightExitOnOutputArgs memory args
    )
        public
    {
        uint192 exitId = ExitId.getInFlightExitId(args.inFlightTx);
        PaymentExitDataModel.InFlightExit storage exit = inFlightExitMap.exits[exitId];

        require(exit.exitStartTimestamp != 0, "No in-flight exit to piggyback on");
        require(exit.isInFirstPhase(self.minExitPeriod), "Can only piggyback in first phase of exit period");

        require(args.outputIndex < MAX_OUTPUT_NUM, "Index exceed max size of the output");
        require(!exit.isOutputPiggybacked(args.outputIndex), "The indexed output has been piggybacked already");

        PaymentExitDataModel.WithdrawData storage withdrawData = exit.outputs[args.outputIndex];

        // Though for inputs, exit target is set during start inFlight exit.
        // For outputs since the output preimage data is hold by the output owners themselves, need to get those on piggyback.
        bytes20 outputGuard = getOutputGuardFromPaymentTxBytes(args.inFlightTx, args.outputIndex);
        address payable exitTarget = getExitTargetOfOutput(self, outputGuard, args.outputType, args.outputGuardPreimage);
        require(exitTarget == msg.sender, "Can be called by the exit target only");

        if (exit.isFirstPiggybackOfTheToken(withdrawData.token)) {
            enqueue(self, withdrawData.token, UtxoPosLib.UtxoPos(exit.position), exitId);
        }

        // Exit Target for outputs is set in piggyback instead of start in-flight exit
        withdrawData.exitTarget = exitTarget;
        withdrawData.piggybackBondSize = msg.value;

        exit.setOutputPiggybacked(args.outputIndex);

        emit InFlightExitOutputPiggybacked(msg.sender, keccak256(args.inFlightTx), args.outputIndex);
    }

    function enqueue(
        Controller memory controller,
        address token,
        UtxoPosLib.UtxoPos memory utxoPos,
        uint192 exitId
    )
        private
    {
        (, uint256 blockTimestamp) = controller.framework.blocks(utxoPos.blockNum());

        // TODO: change the ExitableTimestamp interface as 'isDeposit' should be used only in SE, in IFE it doesn't matter
        // Could update the interface to be cleaner and not forcing a "false" here.
        // https://github.com/omisego/plasma-contracts/issues/216
        bool isPositionDeposit = false;
        uint64 exitableAt = controller.exitableTimestampCalculator.calculate(now, blockTimestamp, isPositionDeposit);

        controller.framework.enqueue(token, exitableAt, utxoPos.txPos(), exitId, controller.exitProcessor);
    }

    function getOutputGuardFromPaymentTxBytes(bytes memory txBytes, uint16 outputIndex)
        private
        pure
        returns (bytes20)
    {
        PaymentOutputModel.Output memory output = PaymentTransactionModel.decode(txBytes).outputs[outputIndex];
        return output.outputGuard;
    }

    function getExitTargetOfOutput(
        Controller memory controller,
        bytes20 outputGuard,
        uint256 outputType,
        bytes memory outputGuardPreimage
    )
        private
        view
        returns (address payable)
    {
        OutputGuardModel.Data memory outputGuardData = OutputGuardModel.Data({
            guard: outputGuard,
            outputType: outputType,
            preimage: outputGuardPreimage
        });
        IOutputGuardHandler handler = controller.outputGuardHandlerRegistry
                                                .outputGuardHandlers(outputType);

        require(address(handler) != address(0),
            "Does not have outputGuardHandler registered for the output type");

        require(handler.isValid(outputGuardData),
                "Some of the output guard related information is not valid");
        return handler.getExitTarget(outputGuardData);
    }
}
