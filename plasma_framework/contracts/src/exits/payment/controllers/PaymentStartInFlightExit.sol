pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../PaymentInFlightExitModelUtils.sol";
import "../routers/PaymentInFlightExitRouterArgs.sol";
import "../spendingConditions/IPaymentSpendingCondition.sol";
import "../spendingConditions/PaymentSpendingConditionRegistry.sol";
import "../../registries/OutputGuardHandlerRegistry.sol";
import "../../utils/ExitableTimestamp.sol";
import "../../utils/ExitId.sol";
import "../../utils/OutputId.sol";
import "../../utils/TxFinalization.sol";
import "../../../utils/IsDeposit.sol";
import "../../../utils/UtxoPosLib.sol";
import "../../../utils/Merkle.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../transactions/PaymentTransactionModel.sol";
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
        PaymentSpendingConditionRegistry spendingConditionRegistry;
        OutputGuardHandlerRegistry outputGuardHandlerRegistry;
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
     * @param inputTxsRaw Input transactions as bytes.
     * @param inputTxs Decoded input transactions.
     * @param inputUtxosPos Postions of input utxos.
     * @param inputUtxosTypes Types of outputs that make in-flight transaction inputs.
     * @param inputTxsInclusionProofs Merkle proofs for input transactions.
     * @param inputUtxosGuardPreimages Output guard preimage for the inputs.
     * @param inputTxsConfirmSigs Confirm signatures for the input txs.
     * @param inFlightTxWitnesses Witnesses for in-flight transactions.
     * @param outputIds Output ids for input transactions.
     */
    struct StartExitData {
        Controller controller;
        uint192 exitId;
        bytes inFlightTxRaw;
        PaymentTransactionModel.Transaction inFlightTx;
        bytes32 inFlightTxHash;
        bytes[] inputTxsRaw;
        PaymentTransactionModel.Transaction[] inputTxs;
        UtxoPosLib.UtxoPos[] inputUtxosPos;
        uint256[] inputUtxosTypes;
        bytes[] inputTxsInclusionProofs;
        bytes[] inputUtxosGuardPreimages;
        bytes[] inputTxsConfirmSigs;
        bytes[] inFlightTxWitnesses;
        bytes32[] outputIds;
    }

    function buildController(
        PlasmaFramework framework,
        PaymentSpendingConditionRegistry spendingConditionRegistry,
        OutputGuardHandlerRegistry outputGuardHandlerRegistry,
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
            outputGuardHandlerRegistry: outputGuardHandlerRegistry,
            supportedTxType: supportedTxType
        });
    }

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
        exitData.inputTxsRaw = args.inputTxs;
        exitData.inputTxs = decodeInputTxs(exitData.inputTxsRaw);
        exitData.inputUtxosPos = decodeInputTxsPositions(args.inputUtxosPos);
        exitData.inputUtxosTypes = args.inputUtxosTypes;
        exitData.inputTxsInclusionProofs = args.inputTxsInclusionProofs;
        exitData.inFlightTxWitnesses = args.inFlightTxWitnesses;
        exitData.outputIds = getOutputIds(controller, exitData.inputTxsRaw, exitData.inputUtxosPos);
        return exitData;
    }

    function decodeInputTxsPositions(uint256[] memory inputUtxosPos) private pure returns (UtxoPosLib.UtxoPos[] memory) {
        require(inputUtxosPos.length <= MAX_INPUT_NUM, "To many input transactions provided");

        UtxoPosLib.UtxoPos[] memory utxosPos = new UtxoPosLib.UtxoPos[](inputUtxosPos.length);
        for (uint i = 0; i < inputUtxosPos.length; i++) {
            utxosPos[i] = UtxoPosLib.UtxoPos(inputUtxosPos[i]);
        }
        return utxosPos;
    }

    function decodeInputTxs(bytes[] memory inputTxsRaw) private pure returns (PaymentTransactionModel.Transaction[] memory) {
        PaymentTransactionModel.Transaction[] memory inputTxs = new PaymentTransactionModel.Transaction[](inputTxsRaw.length);
        for (uint i = 0; i < inputTxsRaw.length; i++) {
            inputTxs[i] = PaymentTransactionModel.decode(inputTxsRaw[i]);
        }
        return inputTxs;
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
            outputIds[i] = isDepositTx ?
                OutputId.computeDepositOutputId(inputTxs[i], utxoPos[i].outputIndex(), utxoPos[i].value)
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
        verifyInputsSpendingCondition(exitData);
        verifyInFlightTransactionDoesNotOverspend(exitData);
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
        require(!exit.isFinalized, "This in-flight exit has already been finalized");
    }

    function verifyNumberOfInputsMatchesNumberOfInFlightTransactionInputs(StartExitData memory exitData) private pure {
        require(
            exitData.inputTxs.length == exitData.inFlightTx.inputs.length,
            "Number of input transactions does not match number of in-flight transaction inputs"
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
            exitData.inputTxsInclusionProofs.length == exitData.inFlightTx.inputs.length,
            "Number of input transactions inclusion proofs does not match number of in-flight transaction inputs"
        );
        require(
            exitData.inFlightTxWitnesses.length == exitData.inFlightTx.inputs.length,
            "Number of input transactions witnesses does not match number of in-flight transaction inputs"
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
            IOutputGuardHandler outputGuardHandler = exitData.controller
                                                    .outputGuardHandlerRegistry
                                                    .outputGuardHandlers(exitData.inputUtxosTypes[i]);

            uint16 outputIndex = exitData.inputUtxosPos[i].outputIndex();
            bytes32 outputGuard = exitData.inputTxs[i].outputs[outputIndex].outputGuard;
            OutputGuardModel.Data memory outputGuardData = OutputGuardModel.Data({
                guard: outputGuard,
                outputType: exitData.inputUtxosTypes[i],
                preimage: exitData.inputUtxosGuardPreimages[i]
            });

            require(outputGuardHandler.isValid(outputGuardData),
                    "Output guard information is invalid for the input tx");

            TxFinalization.Verifier memory verifier = TxFinalization.Verifier({
                framework: exitData.controller.framework,
                protocol: exitData.controller.framework.protocols(exitData.inputUtxosTypes[i]),
                txBytes: exitData.inputTxsRaw[i],
                txPos: exitData.inputUtxosPos[i].txPos(),
                inclusionProof: exitData.inputTxsInclusionProofs[i],
                confirmSig: exitData.inputTxsConfirmSigs[i],
                confirmSigAddress: outputGuardHandler.getConfirmSigAddress(outputGuardData)
            });
            require(verifier.isStandardFinalized(), "Input transaction is not standard finalized");
        }
    }

    function verifyInputsSpendingCondition(StartExitData memory exitData) private view {
        for (uint i = 0; i < exitData.inputTxs.length; i++) {
            uint16 outputIndex = exitData.inputUtxosPos[i].outputIndex();
            bytes32 outputGuard = exitData.inputTxs[i].outputs[outputIndex].outputGuard;

            //FIXME: consider moving spending conditions to PlasmaFramework
            IPaymentSpendingCondition condition = exitData.controller.spendingConditionRegistry.spendingConditions(
                exitData.inputUtxosTypes[i], exitData.controller.supportedTxType
            );

            require(address(condition) != address(0), "Spending condition contract not found");

            bool isSpentByInFlightTx = condition.verify(
                outputGuard,
                uint256(0), // should not be used
                bytes32(exitData.inputUtxosPos[i].value),
                exitData.inFlightTxRaw,
                uint8(i),
                exitData.inFlightTxWitnesses[i]
            );
            require(isSpentByInFlightTx, "Spending condition failed");
        }
    }

    function verifyInFlightTransactionDoesNotOverspend(StartExitData memory exitData) private pure {
        PaymentTransactionModel.Transaction memory inFlightTx = exitData.inFlightTx;
        for (uint i = 0; i < inFlightTx.outputs.length; i++) {
            address token = inFlightTx.outputs[i].token;
            uint256 tokenAmountOut = getTokenAmountOut(inFlightTx, token);
            uint256 tokenAmountIn = getTokenAmountIn(exitData.inputTxs, exitData.inputUtxosPos, token);
            require(tokenAmountOut <= tokenAmountIn, "Invalid transaction, spends more than provided in inputs");
        }
    }

    function getTokenAmountOut(PaymentTransactionModel.Transaction memory inFlightTx, address token) private pure returns (uint256) {
        uint256 amountOut = 0;
        for (uint i = 0; i < inFlightTx.outputs.length; i++) {
            if (inFlightTx.outputs[i].token == token) {
                amountOut += inFlightTx.outputs[i].amount;
            }
        }
        return amountOut;
    }

    function getTokenAmountIn(
        PaymentTransactionModel.Transaction[] memory inputTxs,
        UtxoPosLib.UtxoPos[] memory inputUtxosPos,
        address token
    )
        private
        pure
        returns (uint256)
    {
        uint256 amountIn = 0;
        for (uint i = 0; i < inputTxs.length; i++) {
            uint16 oindex = inputUtxosPos[i].outputIndex();
            PaymentOutputModel.Output memory output = inputTxs[i].outputs[oindex];
            if (output.token == token) {
                amountIn += output.amount;
            }
        }
        return amountIn;
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
        ife.position = getYoungestInputUtxoPosition(startExitData.inputUtxosPos);
        ife.exitStartTimestamp = uint64(block.timestamp);
        setInFlightExitInputs(ife, startExitData.inputTxs, startExitData.inputUtxosPos);
        // output is set during a piggyback
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
        PaymentTransactionModel.Transaction[] memory inputTxs,
        UtxoPosLib.UtxoPos[] memory inputUtxosPos
    )
        private
    {
        for (uint i = 0; i < inputTxs.length; i++) {
            uint16 outputIndex = inputUtxosPos[i].outputIndex();
            PaymentOutputModel.Output memory output = inputTxs[i].outputs[outputIndex];
            ife.inputs[i].exitTarget = output.owner();
            ife.inputs[i].token = output.token;
            ife.inputs[i].amount = output.amount;
        }
    }
}
