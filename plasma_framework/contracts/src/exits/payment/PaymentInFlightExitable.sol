pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./PaymentExitDataModel.sol";
import "./spendingConditions/IPaymentSpendingCondition.sol";
import "./spendingConditions/PaymentSpendingConditionRegistry.sol";
import "../utils/ExitId.sol";
import "../utils/ExitableTimestamp.sol";
import "../utils/OutputId.sol";
import "../../framework/PlasmaFramework.sol";
import "../../utils/Bits.sol";
import "../../utils/IsDeposit.sol";
import "../../utils/SliceUtils.sol";
import "../../utils/OnlyWithValue.sol";
import "../../utils/UtxoPosLib.sol";
import "../../utils/Merkle.sol";
import "../../transactions/PaymentTransactionModel.sol";
import "../../transactions/outputs/PaymentOutputModel.sol";

contract PaymentInFlightExitable is
    OnlyWithValue,
    PaymentSpendingConditionRegistry
{
    using ExitableTimestamp for ExitableTimestamp.Calculator;
    using IsDeposit for IsDeposit.Predicate;
    using PaymentOutputModel for PaymentOutputModel.Output;
    using RLP for bytes;
    using RLP for RLP.RLPItem;
    using UtxoPosLib for UtxoPosLib.UtxoPos;

    uint8 constant public MAX_INPUT_NUM = 4;
    uint256 public constant IN_FLIGHT_EXIT_BOND = 31415926535 wei;
    mapping (uint192 => PaymentExitDataModel.InFlightExit) public inFlightExits;

    PlasmaFramework private framework;
    IsDeposit.Predicate private isDeposit;
    ExitableTimestamp.Calculator private exitableTimestampCalculator;

    event InFlightExitStarted(
        address indexed owner,
        bytes32 txHash
    );

    /**
    * @notice Wraps arguments for startInFlightExit.
    * @param inFlightTx RLP encoded in-flight transaction.
    * @param inputTxs Transactions that created the inputs to the in-flight transaction. In the same order as in-flight transaction inputs.
    * @param inputUtxosPos Utxos that represent in-flight transaction inputs. In the same order as input transactions.
    * @param inputUtxosTypes Output types of in flight transaction inputs. In the same order as input transactions.
    * @param inputTxsInclusionProofs Merkle proofs that show the input-creating transactions are valid. In the same order as input transactions.
    * @param inFlightTxSigs Signatures from the owners of each input. In the same order as input transactions.
    */
    struct StartExitArgs {
        bytes inFlightTx;
        bytes inputTxs;
        bytes inputUtxosPos;
        bytes inputUtxosTypes;
        bytes inputTxsInclusionProofs;
        bytes inFlightTxSigs;
    }

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
     * @param inputTxsInclusionProofs Concatenated Merkle proofs for input transactions.
     * @param inFlightTxSigs Concatenated signatures of in-flight transactions.
     * @param outputIds Output ids for input transactions.
     */
    struct StartExitData {
        uint192 exitId;
        bytes inFlightTxRaw;
        PaymentTransactionModel.Transaction inFlightTx;
        bytes32 inFlightTxHash;
        bytes[] inputTxsRaw;
        PaymentTransactionModel.Transaction[] inputTxs;
        UtxoPosLib.UtxoPos[] inputUtxosPos;
        uint256[] inputUtxosTypes;
        bytes inputTxsInclusionProofs;
        bytes inFlightTxSigs;
        bytes32[] outputIds;
    }

    constructor(address _framework) public {
        framework = PlasmaFramework(_framework);
        isDeposit = IsDeposit.Predicate(framework.CHILD_BLOCK_INTERVAL());
        exitableTimestampCalculator = ExitableTimestamp.Calculator(framework.minExitPeriod());
    }

    /**
     * @notice Starts withdrawal from a transaction that might be in-flight.
     * @dev requires the exiting UTXO's token to be added via 'addToken'
     * @dev Uses struct as input because too many variables and failed to compile.
     * @dev Uses public instead of external because ABIEncoder V2 does not support struct calldata + external
     * @param args input argument data to challenge. See struct 'StartExitArgs' for detailed info.
     */
    function startInFlightExit(StartExitArgs memory args) public payable onlyWithValue(IN_FLIGHT_EXIT_BOND) {
        StartExitData memory startExitData = createStartExitData(args);
        verifyStart(startExitData);
        //TODO: should check if there are standard exits conflicting with this ife and set isCanonical
        bool isCanonical = true;
        startExit(startExitData, isCanonical);
        emit InFlightExitStarted(msg.sender, startExitData.inFlightTxHash);
    }

    function createStartExitData(StartExitArgs memory args) private view returns (StartExitData memory) {
        StartExitData memory exitData;
        exitData.exitId = ExitId.getInFlightExitId(args.inFlightTx);
        exitData.inFlightTxRaw = args.inFlightTx;
        exitData.inFlightTx = PaymentTransactionModel.decode(args.inFlightTx);
        exitData.inFlightTxHash = keccak256(args.inFlightTx);
        exitData.inputTxsRaw = decodeInputTxsRaw(args.inputTxs);
        exitData.inputTxs = decodeInputTxs(exitData.inputTxsRaw);
        exitData.inputUtxosPos = decodeInputTxsPositions(args.inputUtxosPos);
        exitData.inputUtxosTypes = decodeInputUtxosTypes(args.inputUtxosTypes);
        exitData.inputTxsInclusionProofs = args.inputTxsInclusionProofs;
        exitData.inFlightTxSigs = args.inFlightTxSigs;
        exitData.outputIds = getOutputIds(exitData.inputTxsRaw, exitData.inputUtxosPos);
        return exitData;
    }

    function decodeInputUtxosTypes(bytes memory inputUtxosTypesRaw) private pure returns (uint256[] memory) {
        RLP.RLPItem[] memory rlpInputUtxosTypes = inputUtxosTypesRaw.toRLPItem().toList();
        uint256[] memory inputUtxosTypes = new uint256[](rlpInputUtxosTypes.length);
        for (uint i = 0; i < rlpInputUtxosTypes.length; i++) {
            inputUtxosTypes[i] = rlpInputUtxosTypes[i].toUint();
        }
        return inputUtxosTypes;
    }

    function decodeInputTxsRaw(bytes memory inputTxs) private pure returns (bytes[] memory) {
        RLP.RLPItem[] memory rlpInputTxs = inputTxs.toRLPItem().toList();
        bytes[] memory inputTxsRaw = new bytes[](rlpInputTxs.length);
        for (uint i = 0; i < rlpInputTxs.length; i++) {
            inputTxsRaw[i] = rlpInputTxs[i].toData();
        }
        return inputTxsRaw;
    }

    function decodeInputTxsPositions(bytes memory inputUtxosPos) private pure returns (UtxoPosLib.UtxoPos[] memory) {
        RLP.RLPItem[] memory rlpInputUtxosPos = inputUtxosPos.toRLPItem().toList();
        require(rlpInputUtxosPos.length <= MAX_INPUT_NUM, "To many input transactions provided");

        UtxoPosLib.UtxoPos[] memory utxosPos = new UtxoPosLib.UtxoPos[](rlpInputUtxosPos.length);
        for (uint8 i = 0; i < rlpInputUtxosPos.length; i++) {
            utxosPos[i] = UtxoPosLib.UtxoPos(rlpInputUtxosPos[i].toUint());
        }
        return utxosPos;
    }

    function decodeInputTxs(bytes[] memory inputTxsRaw) private pure returns (PaymentTransactionModel.Transaction[] memory) {
        PaymentTransactionModel.Transaction[] memory inputTxs = new PaymentTransactionModel.Transaction[](inputTxsRaw.length);
        for (uint8 i = 0; i < inputTxsRaw.length; i++) {
            inputTxs[i] = PaymentTransactionModel.decode(inputTxsRaw[i]);
        }
        return inputTxs;
    }

    function getOutputIds(bytes[] memory inputTxs, UtxoPosLib.UtxoPos[] memory utxoPos) private view returns (bytes32[] memory) {
        require(inputTxs.length == utxoPos.length, "Number of input transactions does not match number of provided input utxos positions");
        bytes32[] memory outputIds = new bytes32[](inputTxs.length);
        for (uint8 i = 0; i < inputTxs.length; i++) {
            bool isDepositTx = isDeposit.test(utxoPos[i].blockNum());
            outputIds[i] = isDepositTx ?
                OutputId.computeDepositOutputId(inputTxs[i], utxoPos[i].outputIndex(), utxoPos[i].value)
                : OutputId.computeNormalOutputId(inputTxs[i], utxoPos[i].outputIndex());
        }
        return outputIds;
    }

    function verifyStart(StartExitData memory exitData) private view {
        verifyExitNotStarted(exitData.exitId);
        verifyNoInputSpentMoreThanOnce(exitData.inFlightTx);
        verifyInFlightTxSpendsInputTxs(exitData);
        verifyInputTransactionsInludedInPlasma(exitData);
        verifyInputsSpendsSigned(exitData);
        verifyInFlightTransactionDoesNotOverspend(exitData);
    }

    function verifyExitNotStarted(uint192 exitId) private view {
        PaymentExitDataModel.InFlightExit storage exit = inFlightExits[exitId];
        require(exit.exitStartTimestamp == 0, "There is an active in-flight exit from this transaction");
        require(!isFinalized(exit), "This in-flight exit has already been finalized");
    }

    function isFinalized(PaymentExitDataModel.InFlightExit storage ife) private view returns (bool) {
        return Bits.bitSet(ife.exitMap, 255);
    }

    function verifyNoInputSpentMoreThanOnce(PaymentTransactionModel.Transaction memory inFlightTx) private pure {
        if (inFlightTx.inputs.length > 1) {
            for (uint8 i = 0; i < inFlightTx.inputs.length; i++) {
                for (uint8 j = i + 1; j < inFlightTx.inputs.length; j++) {
                    require(inFlightTx.inputs[i] != inFlightTx.inputs[j], "In-flight transaction must have unique inputs");
                }
            }
        }
    }

    function verifyInFlightTxSpendsInputTxs(StartExitData memory exitData) private pure {
        require(
             exitData.inputTxsRaw.length == exitData.inFlightTx.inputs.length,
            "Number of input transactions does not match number of in-flight transaction inputs"
        );

        for (uint8 i = 0; i < exitData.inputTxsRaw.length; i++) {
            require(exitData.outputIds[i] == exitData.inFlightTx.inputs[i], "In-flight transaction does not stem from input transactions");
        }
    }

    function verifyInputTransactionsInludedInPlasma(StartExitData memory exitData) private view
    {
        for (uint8 i = 0; i < exitData.inputTxs.length; i++) {
            bytes memory inclusionProof = SliceUtils.sliceProof(exitData.inputTxsInclusionProofs, i);
            (bytes32 root, uint256 _timestamp) = framework.blocks(exitData.inputUtxosPos[i].blockNum());
            bytes32 leaf = keccak256(exitData.inputTxsRaw[i]);
            require(
                Merkle.checkMembership(leaf, exitData.inputUtxosPos[i].txIndex(), root, inclusionProof),
                "Input transaction is not included in plasma"
            );
        }
    }

    function verifyInputsSpendsSigned(StartExitData memory exitData) private view {
        for (uint8 i = 0; i < exitData.inputTxs.length; i++) {
            uint16 outputIndex = exitData.inputUtxosPos[i].outputIndex();
            bytes memory signature = SliceUtils.sliceSignature(exitData.inFlightTxSigs, i);

            bytes32 outputGuard = exitData.inputTxs[i].outputs[outputIndex].outputGuard;

            IPaymentSpendingCondition condition = PaymentSpendingConditionRegistry.spendingConditions(
                exitData.inputUtxosTypes[i], exitData.inFlightTx.txType);
            require(address(condition) != address(0), "Spending condition contract not found");

            bool isSpentByInFlightTx = condition.verify(
                outputGuard,
                exitData.inputUtxosPos[i].value,
                exitData.outputIds[i],
                exitData.inFlightTxRaw,
                i,
                signature
            );
            require(isSpentByInFlightTx, "Spending condition failed");
        }
    }

    function verifyInFlightTransactionDoesNotOverspend(StartExitData memory exitData) private pure {
        PaymentTransactionModel.Transaction memory inFlightTx = exitData.inFlightTx;
        for (uint8 i = 0; i < inFlightTx.outputs.length; i++) {
            address token = inFlightTx.outputs[i].token;
            uint256 tokenAmountOut = getTokenAmountOut(inFlightTx, token);
            uint256 tokenAmountIn = getTokenAmountIn(exitData.inputTxs, exitData.inputUtxosPos, token);
            require(tokenAmountOut <= tokenAmountIn, "Invalid in-flight transaction, spends more than provided in inputs");
        }
    }

    function getTokenAmountOut(PaymentTransactionModel.Transaction memory inFlightTx, address token) private pure returns (uint256) {
        uint256 amountOut = 0;
        for (uint8 i = 0; i < inFlightTx.outputs.length; i++) {
            if (inFlightTx.outputs[i].token == token) {
                amountOut += inFlightTx.outputs[i].amount;
            }
        }
        return amountOut;
    }

    function getTokenAmountIn(
        PaymentTransactionModel.Transaction[] memory inputTxs,
        UtxoPosLib.UtxoPos[] memory inputUtxosPos,
        address token) private pure returns (uint256)
    {
        uint256 amountIn = 0;
        for (uint8 i = 0; i < inputTxs.length; i++) {
            uint16 oindex = inputUtxosPos[i].outputIndex();
            PaymentOutputModel.Output memory output = inputTxs[i].outputs[oindex];
            if (output.token == token) {
                amountIn += output.amount;
            }
        }
        return amountIn;
    }

    function startExit(StartExitData memory startExitData, bool isCanonical) private {
        UtxoPosLib.UtxoPos memory youngestInputUtxo = getYoungestInputUtxo(startExitData.inputUtxosPos);

        PaymentExitDataModel.InFlightExit storage ife = inFlightExits[startExitData.exitId];
        ife.bondOwner = msg.sender;
        ife.exitStartTimestamp = block.timestamp;
        ife.exitPriority = getInFlightExitPriority(startExitData.exitId, youngestInputUtxo.value, block.timestamp);
        setInFlightExitInputs(ife, startExitData.inputTxs, startExitData.inputUtxosPos);
        if (!isCanonical) {
            setNonCanonical(ife);
        }
    }

    function getYoungestInputUtxo(UtxoPosLib.UtxoPos[] memory inputUtxosPos) private pure returns (UtxoPosLib.UtxoPos memory) {
        UtxoPosLib.UtxoPos memory youngest = inputUtxosPos[0];
        for (uint8 i = 1; i < inputUtxosPos.length; i++) {
            if (inputUtxosPos[i].value < youngest.value) {
                youngest = inputUtxosPos[i];
            }
        }
        return youngest;
    }

    function getInFlightExitPriority(
        uint192 exitId,
        uint256 youngestInputUtxoPos,
        uint256 ethereumBlockTimestamp
    ) public view returns (uint256) {
        UtxoPosLib.UtxoPos memory youngestInputUtxo = UtxoPosLib.UtxoPos(youngestInputUtxoPos);
        (bytes32 _root, uint256 inputUtxoTimestamp) = framework.blocks(youngestInputUtxo.blockNum());

        return ((exitableTimestampCalculator.calculate(ethereumBlockTimestamp, inputUtxoTimestamp, false) << 214)
            | (youngestInputUtxoPos << 160)) | exitId;
    }

    function setInFlightExitInputs(
        PaymentExitDataModel.InFlightExit storage ife,
        PaymentTransactionModel.Transaction[] memory inputTxs,
        UtxoPosLib.UtxoPos[] memory inputUtxosPos) private
    {
        for (uint8 i = 0; i < inputTxs.length; i++) {
            uint16 outputIndex = inputUtxosPos[i].outputIndex();
            ife.inputs[i] = inputTxs[i].outputs[outputIndex];
        }
    }

    function setNonCanonical(PaymentExitDataModel.InFlightExit storage ife) private {
        ife.exitStartTimestamp = Bits.setBit(ife.exitStartTimestamp, 254);
    }
}
