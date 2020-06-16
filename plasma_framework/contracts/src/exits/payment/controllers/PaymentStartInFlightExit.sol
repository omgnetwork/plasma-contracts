pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../PaymentInFlightExitModelUtils.sol";
import "../routers/PaymentInFlightExitRouterArgs.sol";
import "../../interfaces/ISpendingCondition.sol";
import "../../interfaces/IStateTransitionVerifier.sol";
import "../../registries/SpendingConditionRegistry.sol";
import "../../utils/ExitableTimestamp.sol";
import "../../utils/ExitId.sol";
import "../../utils/OutputId.sol";
import "../../utils/MoreVpFinalization.sol";
import "../../../utils/PosLib.sol";
import "../../../utils/Merkle.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../transactions/PaymentTransactionModel.sol";
import "../../../transactions/GenericTransaction.sol";

library PaymentStartInFlightExit {
    using ExitableTimestamp for ExitableTimestamp.Calculator;
    using PosLib for PosLib.Position;
    using PaymentInFlightExitModelUtils for PaymentExitDataModel.InFlightExit;
    using PaymentTransactionModel for PaymentTransactionModel.Transaction;

    /**
     * @dev supportedTxType enables code reuse in different Payment Tx versions
     */
    struct Controller {
        PlasmaFramework framework;
        ExitableTimestamp.Calculator exitTimestampCalculator;
        SpendingConditionRegistry spendingConditionRegistry;
        IStateTransitionVerifier transitionVerifier;
        uint256 supportedTxType;
    }

    event InFlightExitStarted(
        address indexed initiator,
        bytes32 indexed txHash
    );

     /**
     * @dev data to be passed around start in-flight exit helper functions
     * @param controller the Controller struct of this library
     * @param exitId ID of the exit
     * @param inFlightTxRaw In-flight transaction as bytes
     * @param inFlightTx Decoded in-flight transaction
     * @param inFlightTxHash Hash of in-flight transaction
     * @param inputTxs Input transactions as bytes
     * @param inputUtxosPos Postions of input utxos coded as integers
     * @param inputTxsInclusionProofs Merkle proofs for input transactions
     * @param inFlightTxWitnesses Witnesses for in-flight transactions
     * @param outputIds Output IDs for input transactions.
     */
    struct StartExitData {
        Controller controller;
        uint168 exitId;
        bytes inFlightTxRaw;
        PaymentTransactionModel.Transaction inFlightTx;
        bytes32 inFlightTxHash;
        bytes[] inputTxs;
        PosLib.Position[] inputUtxosPos;
        bytes[] inputTxsInclusionProofs;
        bytes[] inFlightTxWitnesses;
        bytes32[] outputIds;
    }

    /**
     * @notice Function that builds the controller struct
     * @return Controller struct of PaymentStartInFlightExit
     */
    function buildController(
        PlasmaFramework framework,
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
            exitTimestampCalculator: ExitableTimestamp.Calculator(framework.minExitPeriod()),
            spendingConditionRegistry: spendingConditionRegistry,
            transitionVerifier: transitionVerifier,
            supportedTxType: supportedTxType
        });
    }

    /**
     * @notice Main logic function to start in-flight exit
     * @dev emits InFlightExitStarted event on success
     * @param self The controller struct
     * @param inFlightExitMap The storage of all in-flight exit data
     * @param args Arguments of start in-flight exit function from client
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
        view
        returns (StartExitData memory)
    {
        StartExitData memory exitData;
        exitData.controller = controller;
        exitData.exitId = ExitId.getInFlightExitId(args.inFlightTx);
        exitData.inFlightTxRaw = args.inFlightTx;
        exitData.inFlightTx = PaymentTransactionModel.decode(args.inFlightTx);
        exitData.inFlightTxHash = keccak256(args.inFlightTx);
        exitData.inputTxs = args.inputTxs;
        exitData.inputUtxosPos = decodeInputTxsPositions(args.inputUtxosPos);
        exitData.inputTxsInclusionProofs = args.inputTxsInclusionProofs;
        exitData.inFlightTxWitnesses = args.inFlightTxWitnesses;
        exitData.outputIds = getOutputIds(controller, exitData.inputTxs, exitData.inputUtxosPos);
        return exitData;
    }

    function decodeInputTxsPositions(uint256[] memory inputUtxosPos) private pure returns (PosLib.Position[] memory) {
        require(inputUtxosPos.length <= PaymentTransactionModel.MAX_INPUT_NUM(), "Too many transactions provided");

        PosLib.Position[] memory utxosPos = new PosLib.Position[](inputUtxosPos.length);
        for (uint i = 0; i < inputUtxosPos.length; i++) {
            utxosPos[i] = PosLib.decode(inputUtxosPos[i]);
        }
        return utxosPos;
    }

    function getOutputIds(Controller memory controller, bytes[] memory inputTxs, PosLib.Position[] memory utxoPos)
        private
        view
        returns (bytes32[] memory)
    {
        require(inputTxs.length == utxoPos.length, "Number of input transactions does not match number of provided input utxos positions");
        bytes32[] memory outputIds = new bytes32[](inputTxs.length);
        for (uint i = 0; i < inputTxs.length; i++) {
            bool isDepositTx = controller.framework.isDeposit(utxoPos[i].blockNum);
            outputIds[i] = isDepositTx
                ? OutputId.computeDepositOutputId(inputTxs[i], utxoPos[i].outputIndex, utxoPos[i].encode())
                : OutputId.computeNormalOutputId(inputTxs[i], utxoPos[i].outputIndex);
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
        verifyInFlightTxType(exitData);
        verifyNumberOfInputsMatchesNumberOfInFlightTransactionInputs(exitData);
        verifyNoInputSpentMoreThanOnce(exitData.inFlightTx);
        verifyInputTransactionIsStandardFinalized(exitData);
        verifyInputsSpent(exitData);
        verifyStateTransition(exitData);
    }

    function verifyExitNotStarted(
        uint168 exitId,
        PaymentExitDataModel.InFlightExitMap storage inFlightExitMap
    )
        private
        view
    {
        PaymentExitDataModel.InFlightExit storage exit = inFlightExitMap.exits[exitId];
        require(exit.exitStartTimestamp == 0, "There is an active in-flight exit from this transaction");
    }

    function verifyInFlightTxType(StartExitData memory exitData) private pure {
        require(exitData.inFlightTx.txType == exitData.controller.supportedTxType, "Unsupported transaction type of the exit game");
    }

    function verifyNumberOfInputsMatchesNumberOfInFlightTransactionInputs(StartExitData memory exitData) private pure {
        require(exitData.inputTxs.length != 0, "In-flight transaction must have inputs");
        require(
            exitData.inputTxs.length == exitData.inFlightTx.inputs.length,
            "Number of input transactions does not match number of in-flight transaction inputs"
        );
        require(
            exitData.inputTxsInclusionProofs.length == exitData.inFlightTx.inputs.length,
            "Number of input transactions inclusion proofs does not match the number of in-flight transaction inputs"
        );
        require(
            exitData.inFlightTxWitnesses.length == exitData.inFlightTx.inputs.length,
            "Number of input transaction witnesses does not match the number of in-flight transaction inputs"
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
            bool isStandardFinalized = MoreVpFinalization.isStandardFinalized(
                exitData.controller.framework,
                exitData.inputTxs[i],
                exitData.inputUtxosPos[i].toStrictTxPos(),
                exitData.inputTxsInclusionProofs[i]
            );
            require(isStandardFinalized, "Input transaction is not standard finalized");
        }
    }

    function verifyInputsSpent(StartExitData memory exitData) private view {
        for (uint16 i = 0; i < exitData.inputTxs.length; i++) {
            uint16 outputIndex = exitData.inputUtxosPos[i].outputIndex;
            GenericTransaction.Output memory output = GenericTransaction.getOutput(
                GenericTransaction.decode(exitData.inputTxs[i]),
                outputIndex
            );

            ISpendingCondition condition = exitData.controller.spendingConditionRegistry.spendingConditions(
                output.outputType, exitData.controller.supportedTxType
            );

            require(address(condition) != address(0), "Spending condition contract not found");

            bool isSpentByInFlightTx = condition.verify(
                exitData.inputTxs[i],
                exitData.inputUtxosPos[i].encode(),
                exitData.inFlightTxRaw,
                i,
                exitData.inFlightTxWitnesses[i]
            );
            require(isSpentByInFlightTx, "Spending condition failed");
        }
    }

    function verifyStateTransition(StartExitData memory exitData) private view {
        uint16[] memory outputIndexForInputTxs = new uint16[](exitData.inputTxs.length);
        for (uint i = 0; i < exitData.inFlightTx.inputs.length; i++) {
            outputIndexForInputTxs[i] = exitData.inputUtxosPos[i].outputIndex;
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

    function getYoungestInputUtxoPosition(PosLib.Position[] memory inputUtxosPos) private pure returns (uint256) {
        uint256 youngest = inputUtxosPos[0].encode();
        for (uint i = 1; i < inputUtxosPos.length; i++) {
            uint256 encodedUtxoPos = inputUtxosPos[i].encode();
            if (encodedUtxoPos > youngest) {
                youngest = encodedUtxoPos;
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
            uint16 outputIndex = exitData.inputUtxosPos[i].outputIndex;
            FungibleTokenOutputModel.Output memory output = FungibleTokenOutputModel.getOutput(
                GenericTransaction.decode(exitData.inputTxs[i]),
                outputIndex
            );

            ife.inputs[i].outputId = exitData.outputIds[i];
            ife.inputs[i].exitTarget = address(uint160(output.outputGuard));
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
        for (uint16 i = 0; i < exitData.inFlightTx.outputs.length; i++) {
            // deposit transaction can't be in-flight exited
            bytes32 outputId = OutputId.computeNormalOutputId(exitData.inFlightTxRaw, i);
            FungibleTokenOutputModel.Output memory output = exitData.inFlightTx.getOutput(i);

            ife.outputs[i].outputId = outputId;
            ife.outputs[i].exitTarget = address(uint160(output.outputGuard));
            ife.outputs[i].token = output.token;
            ife.outputs[i].amount = output.amount;
        }
    }
}
