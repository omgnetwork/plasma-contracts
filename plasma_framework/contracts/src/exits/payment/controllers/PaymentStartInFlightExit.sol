pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../PaymentInFlightExitModelUtils.sol";
import "../routers/PaymentInFlightExitRouterArgs.sol";
import "../../interfaces/IOutputGuardHandler.sol";
import "../../interfaces/ISpendingCondition.sol";
import "../../interfaces/IStateTransitionVerifier.sol";
import "../../models/OutputGuardModel.sol";
import "../../registries/SpendingConditionRegistry.sol";
import "../../registries/OutputGuardHandlerRegistry.sol";
import "../../utils/ExitableTimestamp.sol";
import "../../utils/ExitId.sol";
import "../../utils/OutputGuard.sol";
import "../../utils/OutputId.sol";
import "../../utils/TxFinalization.sol";
import "../../../utils/IsDeposit.sol";
import "../../../utils/UtxoPosLib.sol";
import "../../../utils/Merkle.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../transactions/PaymentTransactionModel.sol";
import "../../../transactions/WireTransaction.sol";
import "../../../transactions/outputs/PaymentOutputModel.sol";

library PaymentStartInFlightExit {
    using ExitableTimestamp for ExitableTimestamp.Calculator;
    using IsDeposit for IsDeposit.Predicate;
    using UtxoPosLib for UtxoPosLib.UtxoPos;
    using PaymentInFlightExitModelUtils for PaymentExitDataModel.InFlightExit;
    using PaymentOutputModel for PaymentOutputModel.Output;
    using TxFinalization for TxFinalization.Verifier;

    uint256 constant public MAX_INPUT_NUM = 4;

    struct Controller {
        PlasmaFramework framework;
        IsDeposit.Predicate isDeposit;
        ExitableTimestamp.Calculator exitTimestampCalculator;
        OutputGuardHandlerRegistry outputGuardHandlerRegistry;
        SpendingConditionRegistry spendingConditionRegistry;
        IStateTransitionVerifier transitionVerifier;
        uint256 supportedTxType;
    }

    event InFlightExitStarted(
        address indexed initiator,
        bytes32 txHash
    );

     /**
     * @dev data to be passed around start in-flight exit helper functions
     * @param exitId ID of the exit.
     * @param inFlightTxRaw In-flight transaction as bytes.
     * @param inFlightTx Decoded in-flight transaction.
     * @param inFlightTxHash Hash of in-flight transaction.
     * @param inputTxs Input transactions as bytes.
     * @param inputUtxosPos Postions of input utxos.
     * @param inputUtxosPos Postions of input utxos coded as integers.
     * @param inputUtxosTypes Types of outputs that make in-flight transaction inputs.
     * @param outputGuardPreimagesForInputs Output guard pre-images for in-flight transaction inputs.
     * @param inputTxsInclusionProofs Merkle proofs for input transactions.
     * @param inputTxsConfirmSigs Confirm signatures for the input txs.
     * @param inFlightTxWitnesses Witnesses for in-flight transactions.
     * @param inputSpendingConditionOptionalArgs Optional args for the spending condition for checking inputs.
     * @param outputIds Output ids for input transactions.
     */
    struct StartExitData {
        Controller controller;
        uint192 exitId;
        bytes inFlightTxRaw;
        PaymentTransactionModel.Transaction inFlightTx;
        bytes32 inFlightTxHash;
        bytes[] inputTxs;
        UtxoPosLib.UtxoPos[] inputUtxosPos;
        uint256[] inputUtxosTypes;
        uint256[] inputTxTypes;
        bytes[] outputGuardPreimagesForInputs;
        bytes[] inputTxsInclusionProofs;
        bytes[] inputTxsConfirmSigs;
        bytes[] inFlightTxWitnesses;
        bytes[] inputSpendingConditionOptionalArgs;
        bytes32[] outputIds;
    }

    /**
     * @notice Function that builds the controller struct
     * @return Controller struct of PaymentStartInFlightExit
     */
    function buildController(
        PlasmaFramework framework,
        OutputGuardHandlerRegistry outputGuardHandlerRegistry,
        SpendingConditionRegistry spendingConditionRegistry,
        IStateTransitionVerifier transitionVerifier,
        uint256 supportedTxType
    )
        public
        view
        returns (Controller memory)
    {
        return Controller({
            framework: framework,
            isDeposit: IsDeposit.Predicate(framework.CHILD_BLOCK_INTERVAL()),
            exitTimestampCalculator: ExitableTimestamp.Calculator(framework.minExitPeriod()),
            spendingConditionRegistry: spendingConditionRegistry,
            transitionVerifier: transitionVerifier,
            outputGuardHandlerRegistry: outputGuardHandlerRegistry,
            supportedTxType: supportedTxType
        });
    }

    /**
     * @notice Main logic function to start in-flight exit
     * @dev emits InFlightExitStarted event on success
     * @param self the controller struct
     * @param inFlightExitMap the storage of all in-flight exit data
     * @param args arguments of start in-flight exit function from client.
     */
    function run(
        Controller memory self,
        PaymentExitDataModel.InFlightExitMap storage inFlightExitMap,
        PaymentInFlightExitRouterArgs.StartExitArgs memory args
    )
        public
    {
        StartExitData memory startExitData = createStartExitData(self, args);
        verifyStart(startExitData, inFlightExitMap);
        startExit(startExitData, inFlightExitMap);
        emit InFlightExitStarted(msg.sender, startExitData.inFlightTxHash);
    }

    function createStartExitData(
        Controller memory controller,
        PaymentInFlightExitRouterArgs.StartExitArgs memory args
    )
        private
        pure
        returns (StartExitData memory)
    {
        StartExitData memory exitData;
        exitData.controller = controller;
        exitData.exitId = ExitId.getInFlightExitId(args.inFlightTx);
        exitData.inFlightTxRaw = args.inFlightTx;
        exitData.inFlightTx = PaymentTransactionModel.decode(args.inFlightTx);
        exitData.inFlightTxHash = keccak256(args.inFlightTx);
        exitData.inputTxs = args.inputTxs;
        exitData.inputTxTypes = args.inputTxTypes;
        exitData.inputUtxosPos = decodeInputTxsPositions(args.inputUtxosPos);
        exitData.inputUtxosTypes = args.inputUtxosTypes;
        exitData.inputTxsInclusionProofs = args.inputTxsInclusionProofs;
        exitData.inputTxsConfirmSigs = args.inputTxsConfirmSigs;
        exitData.outputGuardPreimagesForInputs = args.outputGuardPreimagesForInputs;
        exitData.inFlightTxWitnesses = args.inFlightTxWitnesses;
        exitData.inputSpendingConditionOptionalArgs = args.inputSpendingConditionOptionalArgs;
        exitData.outputIds = getOutputIds(controller, exitData.inputTxs, exitData.inputUtxosPos);
        return exitData;
    }

    function decodeInputTxsPositions(uint256[] memory inputUtxosPos) private pure returns (UtxoPosLib.UtxoPos[] memory) {
        require(inputUtxosPos.length <= MAX_INPUT_NUM, "Too many transactions provided");

        UtxoPosLib.UtxoPos[] memory utxosPos = new UtxoPosLib.UtxoPos[](inputUtxosPos.length);
        for (uint i = 0; i < inputUtxosPos.length; i++) {
            utxosPos[i] = UtxoPosLib.UtxoPos(inputUtxosPos[i]);
        }
        return utxosPos;
    }

    function getOutputIds(Controller memory controller, bytes[] memory inputTxs, UtxoPosLib.UtxoPos[] memory utxoPos)
        private
        pure
        returns (bytes32[] memory)
    {
        require(inputTxs.length == utxoPos.length, "Number of input transactions does not match number of provided input utxos positions");
        bytes32[] memory outputIds = new bytes32[](inputTxs.length);
        for (uint i = 0; i < inputTxs.length; i++) {
            bool isDepositTx = controller.isDeposit.test(utxoPos[i].blockNum());
            outputIds[i] = isDepositTx
                ? OutputId.computeDepositOutputId(inputTxs[i], utxoPos[i].outputIndex(), utxoPos[i].value)
                : OutputId.computeNormalOutputId(inputTxs[i], utxoPos[i].outputIndex());
        }
        return outputIds;
    }

    function verifyStart(
        StartExitData memory exitData,
        PaymentExitDataModel.InFlightExitMap storage inFlightExitMap
    )
        private
        view
    {
        verifyExitNotStarted(exitData.exitId, inFlightExitMap);
        verifyNumberOfInputsMatchesNumberOfInFlightTransactionInputs(exitData);
        verifyNoInputSpentMoreThanOnce(exitData.inFlightTx);
        verifyInputTransactionIsStandardFinalized(exitData);
        verifyInputsSpent(exitData);
        verifyStateTransition(exitData);
    }

    function verifyExitNotStarted(
        uint192 exitId,
        PaymentExitDataModel.InFlightExitMap storage inFlightExitMap
    )
        private
        view
    {
        PaymentExitDataModel.InFlightExit storage exit = inFlightExitMap.exits[exitId];
        require(exit.exitStartTimestamp == 0, "There is an active in-flight exit from this transaction");
    }

    function verifyNumberOfInputsMatchesNumberOfInFlightTransactionInputs(StartExitData memory exitData) private pure {
        require(
            exitData.inputTxs.length == exitData.inFlightTx.inputs.length,
            "Number of input transactions does not match number of in-flight transaction inputs"
        );
        require(
            exitData.inputTxTypes.length == exitData.inFlightTx.inputs.length,
            "Number of input tx types does not match number of in-flight transaction inputs"
        );
        require(
            exitData.inputUtxosPos.length == exitData.inFlightTx.inputs.length,
            "Number of input transactions positions does not match number of in-flight transaction inputs"
        );
        require(
            exitData.inputUtxosTypes.length == exitData.inFlightTx.inputs.length,
            "Number of input utxo types does not match number of in-flight transaction inputs"
        );
        require(
            exitData.outputGuardPreimagesForInputs.length == exitData.inFlightTx.inputs.length,
            "Number of output guard preimages for inputs does not match number of in-flight transaction inputs"
        );
        require(
            exitData.inputTxsInclusionProofs.length == exitData.inFlightTx.inputs.length,
            "Number of input transactions inclusion proofs does not match number of in-flight transaction inputs"
        );
        require(
            exitData.inFlightTxWitnesses.length == exitData.inFlightTx.inputs.length,
            "Number of input transactions witnesses does not match number of in-flight transaction inputs"
        );
        require(
            exitData.inputTxsConfirmSigs.length == exitData.inFlightTx.inputs.length,
            "Number of input transactions confirm sigs does not match number of in-flight transaction inputs"
        );
        require(
            exitData.inputSpendingConditionOptionalArgs.length == exitData.inFlightTx.inputs.length,
            "Number of input spending condition optional args does not match number of in-flight transaction inputs"
        );
    }

    function verifyNoInputSpentMoreThanOnce(PaymentTransactionModel.Transaction memory inFlightTx) private pure {
        if (inFlightTx.inputs.length > 1) {
            for (uint i = 0; i < inFlightTx.inputs.length; i++) {
                for (uint j = i + 1; j < inFlightTx.inputs.length; j++) {
                    require(inFlightTx.inputs[i] != inFlightTx.inputs[j], "In-flight transaction must have unique inputs");
                }
            }
        }
    }

    function verifyInputTransactionIsStandardFinalized(StartExitData memory exitData) private view {
        for (uint i = 0; i < exitData.inputTxs.length; i++) {
            uint16 outputIndex = exitData.inputUtxosPos[i].outputIndex();
            WireTransaction.Output memory output = WireTransaction.getOutput(exitData.inputTxs[i], outputIndex);
            OutputGuardModel.Data memory outputGuardData = OutputGuardModel.Data({
                guard: output.outputGuard,
                outputType: exitData.inputUtxosTypes[i],
                preimage: exitData.outputGuardPreimagesForInputs[i]
            });
            IOutputGuardHandler outputGuardHandler = exitData.controller
                                                    .outputGuardHandlerRegistry
                                                    .outputGuardHandlers(exitData.inputUtxosTypes[i]);

            require(address(outputGuardHandler) != address(0), "Failed to get the outputGuardHandler of the output type");

            require(outputGuardHandler.isValid(outputGuardData),
                    "Output guard information is invalid for the input tx");

            uint8 protocol = exitData.controller.framework.protocols(exitData.inputTxTypes[i]);

            TxFinalization.Verifier memory verifier = TxFinalization.Verifier({
                framework: exitData.controller.framework,
                protocol: protocol,
                txBytes: exitData.inputTxs[i],
                txPos: exitData.inputUtxosPos[i].txPos(),
                inclusionProof: exitData.inputTxsInclusionProofs[i],
                confirmSig: exitData.inputTxsConfirmSigs[i],
                confirmSigAddress: outputGuardHandler.getConfirmSigAddress(outputGuardData)
            });
            require(verifier.isStandardFinalized(), "Input transaction is not standard finalized");
        }
    }

    function verifyInputsSpent(StartExitData memory exitData) private view {
        for (uint16 i = 0; i < exitData.inputTxs.length; i++) {
            uint16 outputIndex = exitData.inputUtxosPos[i].outputIndex();
            WireTransaction.Output memory output = WireTransaction.getOutput(exitData.inputTxs[i], outputIndex);

            OutputGuardModel.Data memory outputGuardData = OutputGuardModel.Data({
                guard: output.outputGuard,
                outputType: exitData.inputUtxosTypes[i],
                preimage: exitData.outputGuardPreimagesForInputs[i]
            });
            IOutputGuardHandler outputGuardHandler = exitData.controller
                                                    .outputGuardHandlerRegistry
                                                    .outputGuardHandlers(exitData.inputUtxosTypes[i]);
            require(address(outputGuardHandler) != address(0), "Failed to get the outputGuardHandler of the output type");
            require(outputGuardHandler.isValid(outputGuardData),
                    "Output guard information is invalid for the input tx");

            ISpendingCondition condition = exitData.controller.spendingConditionRegistry.spendingConditions(
                exitData.inputUtxosTypes[i], exitData.controller.supportedTxType
            );

            require(address(condition) != address(0), "Spending condition contract not found");

            bool isSpentByInFlightTx = condition.verify(
                exitData.inputTxs[i],
                exitData.inputUtxosPos[i].outputIndex(),
                exitData.inputUtxosPos[i].txPos().value,
                exitData.inFlightTxRaw,
                i,
                exitData.inFlightTxWitnesses[i],
                exitData.inputSpendingConditionOptionalArgs[i]
            );
            require(isSpentByInFlightTx, "Spending condition failed");
        }
    }

    function verifyStateTransition(StartExitData memory exitData) private view {
        uint16[] memory outputIndexForInputTxs = new uint16[](exitData.inputTxs.length);
        for (uint i = 0; i < exitData.inFlightTx.inputs.length; i++) {
            outputIndexForInputTxs[i] = exitData.inputUtxosPos[i].outputIndex();
        }

        require(
            exitData.controller.transitionVerifier.isCorrectStateTransition(exitData.inFlightTxRaw, exitData.inputTxs, outputIndexForInputTxs),
            "Invalid state transition"
        );
    }

    function startExit(
        StartExitData memory startExitData,
        PaymentExitDataModel.InFlightExitMap storage inFlightExitMap
    )
        private
    {
        PaymentExitDataModel.InFlightExit storage ife = inFlightExitMap.exits[startExitData.exitId];
        ife.isCanonical = true;
        ife.bondOwner = msg.sender;
        ife.bondSize = msg.value;
        ife.position = getYoungestInputUtxoPosition(startExitData.inputUtxosPos);
        ife.exitStartTimestamp = uint64(block.timestamp);
        setInFlightExitInputs(ife, startExitData);
        setInFlightExitOutputs(ife, startExitData);
    }

    function getYoungestInputUtxoPosition(UtxoPosLib.UtxoPos[] memory inputUtxosPos) private pure returns (uint256) {
        uint256 youngest = inputUtxosPos[0].value;
        for (uint i = 1; i < inputUtxosPos.length; i++) {
            if (inputUtxosPos[i].value > youngest) {
                youngest = inputUtxosPos[i].value;
            }
        }
        return youngest;
    }

    function setInFlightExitInputs(
        PaymentExitDataModel.InFlightExit storage ife,
        StartExitData memory exitData
    )
        private
    {
        for (uint i = 0; i < exitData.inputTxs.length; i++) {
            uint16 outputIndex = exitData.inputUtxosPos[i].outputIndex();
            WireTransaction.Output memory output = WireTransaction.getOutput(exitData.inputTxs[i], outputIndex);

            OutputGuardModel.Data memory outputGuardData = OutputGuardModel.Data(
                output.outputGuard,
                exitData.inputUtxosTypes[i],
                exitData.outputGuardPreimagesForInputs[i]
            );
            IOutputGuardHandler handler = exitData.controller.outputGuardHandlerRegistry.outputGuardHandlers(exitData.inputUtxosTypes[i]);
            require(address(handler) != address(0), "Output guard handler not registered");
            address payable exitTarget = handler.getExitTarget(outputGuardData);

            ife.inputs[i].outputId = exitData.outputIds[i];
            ife.inputs[i].exitTarget = exitTarget;
            ife.inputs[i].token = output.token;
            ife.inputs[i].amount = output.amount;
        }
    }

    function setInFlightExitOutputs(
        PaymentExitDataModel.InFlightExit storage ife,
        StartExitData memory exitData
    )
        private
    {
        for (uint i = 0; i < exitData.inFlightTx.outputs.length; i++) {
            // deposit transaction can't be in-flight exited
            bytes32 outputId = OutputId.computeNormalOutputId(exitData.inFlightTxRaw, i);
            PaymentOutputModel.Output memory output = exitData.inFlightTx.outputs[i];

            ife.outputs[i].outputId = outputId;
            // exit target is not set as output guard preimage many not be available for caller
            ife.outputs[i].token = output.token;
            ife.outputs[i].amount = output.amount;
        }
    }
}
