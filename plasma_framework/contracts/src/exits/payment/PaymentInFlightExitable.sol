pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./PaymentExitDataModel.sol";
import "./spendingConditions/IPaymentSpendingCondition.sol";
import "./spendingConditions/PaymentSpendingConditionRegistry.sol";
import "../utils/ExitId.sol";
import "../utils/ExitableTimestamp.sol";
import "../utils/OutputId.sol";
import "../../framework/PlasmaFramework.sol";
import "../../framework/interfaces/IExitProcessor.sol";
import "../../utils/Bits.sol";
import "../../utils/IsDeposit.sol";
import "../../utils/OnlyWithValue.sol";
import "../../utils/UtxoPosLib.sol";
import "../../utils/Merkle.sol";
import "../../transactions/PaymentTransactionModel.sol";
import "../../transactions/outputs/PaymentOutputModel.sol";

contract PaymentInFlightExitable is
    IExitProcessor,
    OnlyWithValue,
    PaymentSpendingConditionRegistry
{
    using ExitableTimestamp for ExitableTimestamp.Calculator;
    using IsDeposit for IsDeposit.Predicate;
    using PaymentOutputModel for PaymentOutputModel.Output;
    using RLP for bytes;
    using RLP for RLP.RLPItem;
    using UtxoPosLib for UtxoPosLib.UtxoPos;
    using Bits for uint256;

    uint8 constant public MAX_INPUT_NUM = 4;
    uint256 public constant IN_FLIGHT_EXIT_BOND = 31415926535 wei;
    mapping (uint192 => PaymentExitDataModel.InFlightExit) public inFlightExits;

    PlasmaFramework private framework;
    IsDeposit.Predicate private isDeposit;
    ExitableTimestamp.Calculator private exitableTimestampCalculator;

    event InFlightExitStarted(
        address indexed initiator,
        bytes32 txHash
    );

    event InFlightExitChallenged(
        address indexed challenger,
        bytes32 txHash,
        uint256 challengeTxPosition
    );

    /**
    * @notice Wraps arguments for startInFlightExit.
    * @param inFlightTx RLP encoded in-flight transaction.
    * @param inputTxs Transactions that created the inputs to the in-flight transaction. In the same order as in-flight transaction inputs.
    * @param inputUtxosPos Utxos that represent in-flight transaction inputs. In the same order as input transactions.
    * @param inputUtxosTypes Output types of in flight transaction inputs. In the same order as input transactions.
    * @param inputTxsInclusionProofs Merkle proofs that show the input-creating transactions are valid. In the same order as input transactions.
    * @param inFlightTxWitnesses Witnesses for in-flight transaction. In the same order as input transactions.
    */
    struct StartExitArgs {
        bytes inFlightTx;
        bytes[] inputTxs;
        uint256[] inputUtxosPos;
        uint256[] inputUtxosTypes;
        bytes[] inputTxsInclusionProofs;
        bytes[] inFlightTxWitnesses;
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
     * @param inputTxsInclusionProofs Merkle proofs for input transactions.
     * @param inFlightTxWitnesses Witnesses for in-flight transactions.
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
        bytes[] inputTxsInclusionProofs;
        bytes[] inFlightTxWitnesses;
        // TODO: Output Ids are only computed and not used in exit
        bytes32[] outputIds;
    }

    struct ChallengeCanonicityArgs {
        bytes inFlightTx;
        uint8 inFlightTxInputIndex;
        bytes competingTx;
        uint8 competingTxInputIndex;
        uint256 competingTxInputOutputType;
        uint256 competingTxPos;
        bytes competingTxInclusionProof;
        bytes competingTxWitness;
    }

    constructor(PlasmaFramework _framework) public {
        framework = _framework;
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
        startExit(startExitData);
        emit InFlightExitStarted(msg.sender, startExitData.inFlightTxHash);
    }

    function challengeInFlightExitNotCanonical(ChallengeCanonicityArgs memory args) public payable {
        // Check if there is an active in-flight exit from this transaction?
        uint192 exitId = ExitId.getInFlightExitId(args.inFlightTx);
        PaymentExitDataModel.InFlightExit storage ife = inFlightExits[exitId];
        require(ife.exitStartTimestamp != 0, "In-fligh exit doesn't exists");

        // Check that the exit is active and in period 1
        verifyFirstPhaseNotOver(ife);

        // Check if exit's input was spent via MVP exit
        // If I'm correct we no longer can check any of inputs was previously exited by Std exit
        // RootChain sets 254-bit in the timestamp to check this
        /// verifyInputNotSpent(ife);

        // Check that two transactions are not the same
        require(
            keccak256(args.inFlightTx) != keccak256(args.competingTx),
            "The competitor transaction is the same as transaction in-flight"
        );

        PaymentTransactionModel.Transaction memory inFlightTx = PaymentTransactionModel.decode(args.inFlightTx);

        // Check that shared input owner signes competing transaction
        require(
            isSpendingConditionMet(
                ife.inputs[args.inFlightTxInputIndex].outputGuard,
                uint256(0), // should not be used
                inFlightTx.inputs[args.inFlightTxInputIndex],
                // can we trust the caller or we should extend storage for input outputTypes?
                args.competingTxInputOutputType,
                args.competingTx,
                // also, shouldn't txType be hardcoded into this contract, as it servers as exit game for this particular tx type?
                inFlightTx.txType,
                args.competingTxInputIndex,
                args.competingTxWitness
            ),
            "Competing input spending condition is not met"
        );

        // Determine the position of the competing transaction
        uint256 competitorPosition = ~uint256(0);
        if (args.competingTxPos != 0) {
            competitorPosition = verifyAndDeterminePositionOfTransactionIncludedInBlock(
                args.competingTx,
                UtxoPosLib.UtxoPos(args.competingTxPos),
                args.competingTxInclusionProof
            );
        }

        // Competitor must be first or must be older than the current oldest competitor.
        require(
            ife.oldestCompetitorPosition == 0 || ife.oldestCompetitorPosition > competitorPosition,
            "Competing transaction is not older than already known competitor"
        );

        ife.oldestCompetitorPosition = competitorPosition;
        ife.bondOwner = msg.sender;

        // Set a flag so that only the inputs are exitable, unless a response is received.
        ife.isCanonical = false;

        emit InFlightExitChallenged(msg.sender, keccak256(args.inFlightTx), competitorPosition);
    }

    function createStartExitData(StartExitArgs memory args) private view returns (StartExitData memory) {
        StartExitData memory exitData;
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
        exitData.outputIds = getOutputIds(exitData.inputTxsRaw, exitData.inputUtxosPos);
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

    function getOutputIds(bytes[] memory inputTxs, UtxoPosLib.UtxoPos[] memory utxoPos) private view returns (bytes32[] memory) {
        require(inputTxs.length == utxoPos.length, "Number of input transactions does not match number of provided input utxos positions");
        bytes32[] memory outputIds = new bytes32[](inputTxs.length);
        for (uint i = 0; i < inputTxs.length; i++) {
            bool isDepositTx = isDeposit.test(utxoPos[i].blockNum());
            outputIds[i] = isDepositTx ?
                OutputId.computeDepositOutputId(inputTxs[i], utxoPos[i].outputIndex(), utxoPos[i].value)
                : OutputId.computeNormalOutputId(inputTxs[i], utxoPos[i].outputIndex());
        }
        return outputIds;
    }

    function verifyStart(StartExitData memory exitData) private view {
        verifyExitNotStarted(exitData.exitId);
        verifyNumberOfInputsMatchesNumberOfInFlightTransactionInputs(exitData);
        verifyNoInputSpentMoreThanOnce(exitData.inFlightTx);
        verifyInputTransactionsIncludedInPlasma(exitData);
        verifyInputsSpendingCondition(exitData);
        verifyInFlightTransactionDoesNotOverspend(exitData);
    }

    function verifyExitNotStarted(uint192 exitId) private view {
        PaymentExitDataModel.InFlightExit storage ife = inFlightExits[exitId];
        require(ife.exitStartTimestamp == 0, "There is an active in-flight exit from this transaction");
        require(!isFinalized(ife), "This in-flight exit has already been finalized");
    }

    function isFinalized(PaymentExitDataModel.InFlightExit storage ife) private view returns (bool) {
        return ife.exitMap.bitSet(255);
    }

    function isSpendingConditionMet(
        bytes32 outputGuard,
        uint256 utxoPos,
        bytes32 outputId,
        uint256 outputType,
        bytes memory spendingTx,
        uint256 spendingTxType,
        uint8 inputIndex,
        bytes memory witness
    ) private view returns(bool) {
        //FIXME: consider moving spending conditions to PlasmaFramework
        IPaymentSpendingCondition condition = PaymentSpendingConditionRegistry
            .spendingConditions(outputType, spendingTxType);
        require(address(condition) != address(0), "Spending condition contract not found");

        return condition.verify(outputGuard, utxoPos, outputId, spendingTx, inputIndex, witness);
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

    function verifyInputTransactionsIncludedInPlasma(StartExitData memory exitData) private view {
        for (uint i = 0; i < exitData.inputTxs.length; i++) {
            verifyAndDeterminePositionOfTransactionIncludedInBlock(
                exitData.inputTxsRaw[i],
                exitData.inputUtxosPos[i],
                exitData.inputTxsInclusionProofs[i]
            );
        }
    }

    function verifyAndDeterminePositionOfTransactionIncludedInBlock(
        bytes memory txbytes,
        UtxoPosLib.UtxoPos memory utxoPos,
        bytes memory inclusionProof
    ) private view returns(uint256) {
        (bytes32 root, ) = framework.blocks(utxoPos.blockNum());
        bytes32 leaf = keccak256(txbytes);
        require(
            Merkle.checkMembership(leaf, utxoPos.txIndex(), root, inclusionProof),
            "Transaction is not included in block of plasma chain"
        );

        return utxoPos.value;
    }

    function verifyInputsSpendingCondition(StartExitData memory exitData) private view {
        for (uint i = 0; i < exitData.inputTxs.length; i++) {
            uint16 outputIndex = exitData.inputUtxosPos[i].outputIndex();
            bytes32 outputGuard = exitData.inputTxs[i].outputs[outputIndex].outputGuard;

            bool isSpentByInFlightTx = isSpendingConditionMet(
                outputGuard,
                uint256(0), // should not be used
                bytes32(exitData.inputUtxosPos[i].value),
                exitData.inputUtxosTypes[i],
                exitData.inFlightTxRaw,
                exitData.inFlightTx.txType,
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

    /**
     * @dev Checks that in-flight exit is in phase that allows for piggybacks and canonicity challenges.
     * @param ife in-flight exit to check.
     */
    function verifyFirstPhaseNotOver(PaymentExitDataModel.InFlightExit storage ife) private view {
        uint256 phasePeriod = framework.minExitPeriod() / 2;
        bool firstPhasePassed = ((block.timestamp - ife.exitStartTimestamp) / phasePeriod) >= 1;
        require(firstPhasePassed, "Canonicity challege phase for this exit has ended");
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

    function startExit(StartExitData memory startExitData) private {
        PaymentExitDataModel.InFlightExit storage ife = inFlightExits[startExitData.exitId];
        ife.bondOwner = msg.sender;
        ife.position = getYoungestInputUtxoPosition(startExitData.inputUtxosPos);
        ife.exitStartTimestamp = uint64(block.timestamp);
        ife.isCanonical = true;
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
            ife.inputs[i] = inputTxs[i].outputs[outputIndex];
        }
    }
}
