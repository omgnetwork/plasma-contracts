pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./PaymentExitDataModel.sol";
import "./spendingConditions/IPaymentSpendingCondition.sol";
import "./spendingConditions/PaymentSpendingConditionRegistry.sol";
import "../IOutputGuardParser.sol";
import "../OutputGuardParserRegistry.sol";
import "../utils/ExitId.sol";
import "../utils/ExitableTimestamp.sol";
import "../utils/OutputId.sol";
import "../utils/OutputGuard.sol";
import "../../framework/interfaces/IPlasmaFramework.sol";
import "../../framework/interfaces/IExitProcessor.sol";
import "../../framework/models/ExitModel.sol";
import "../../utils/IsDeposit.sol";
import "../../utils/OnlyWithValue.sol";
import "../../utils/TxPosLib.sol";
import "../../utils/UtxoPosLib.sol";
import "../../utils/Merkle.sol";
import "../../transactions/PaymentTransactionModel.sol";
import "../../transactions/outputs/PaymentOutputModel.sol";

contract PaymentStandardExitable is
    IExitProcessor,
    OnlyWithValue,
    OutputGuardParserRegistry,
    PaymentSpendingConditionRegistry
{
    using PaymentOutputModel for PaymentOutputModel.Output;
    using UtxoPosLib for UtxoPosLib.UtxoPos;
    using TxPosLib for TxPosLib.TxPos;
    using IsDeposit for IsDeposit.Predicate;
    using ExitableTimestamp for ExitableTimestamp.Calculator;

    uint256 public constant standardExitBond = 31415926535 wei;
    mapping (uint192 => PaymentExitDataModel.StandardExit) public exits;

    IPlasmaFramework private framework;
    IsDeposit.Predicate private isDeposit;
    ExitableTimestamp.Calculator private exitableTimestampCalculator;

    struct StartStandardExitInputData {
        uint192 utxoPos;
        bytes rlpOutputTx;
        uint256 outputType;
        bytes outputGuardData;
        bytes outputTxInclusionProof;
    }

    /**
     * @dev data to be passed around startStandardExit helper functions
     */
    struct StartStandardExitData {
        StartStandardExitInputData input;
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

    /**
     * @notice input data for challengeStandardExit.
     * @param _exitId Identifier of the standard exit to challenge.
     * @param _outputType The output type of the exiting output.
     * @param _outputUtxoPos The utxo position of the exiting output.
     * @param _outputId The unique id of exiting output.
     * @param _outputGuardData (optional) The output guard data of the output. Could be empty when output type is 0.
     * @param _challengeTxType The tx type if the challenge transaction.
     * @param _challengeTx RLP encoded transaction that spends the exiting output.
     * @param _inputIndex Which input of the challenging tx corresponds to the exiting output.
     * @param _witness Witness data that can prove the exiting output is spent.
     */
    struct ChallengeStandardExitInputData {
        uint192 exitId;
        uint256 outputType;
        uint256 outputUtxoPos;
        bytes32 outputId;
        bytes32 outputGuard;
        uint256 challengeTxType;
        bytes challengeTx;
        uint8 inputIndex;
        bytes witness;
    }

    /**
     * @dev data to be passed around challengeStandardExit helper functions
     */
    struct ChallengeStandardExitData {
        ChallengeStandardExitInputData input;
        PaymentExitDataModel.StandardExit exitData;
    }

    event ExitStarted(
        address indexed owner,
        uint192 exitId
    );

    event ExitChallenged(
        uint256 indexed utxoPos
    );

    constructor(address _framework) public {
        framework = IPlasmaFramework(_framework);
        isDeposit = IsDeposit.Predicate(framework.CHILD_BLOCK_INTERVAL());
        exitableTimestampCalculator = ExitableTimestamp.Calculator(framework.minExitPeriod());
    }

    /**
     * @notice Starts a standard withdrawal of a given output. Uses output-age priority.
     * @dev requires the exiting UTXO's token to be added via 'addToken'
     * @param _utxoPos Position of the exiting output.
     * @param _rlpOutputTx RLP encoded transaction that created the exiting output.
     * @param _outputType Specific type of the output.
     * @param _outputGuardData (Optional) Output guard data if the output type is not 0.
     * @param _outputTxInclusionProof A Merkle proof showing that the transaction was included.
     */
    function startStandardExit(
        uint192 _utxoPos,
        bytes calldata _rlpOutputTx,
        uint256 _outputType,
        bytes calldata _outputGuardData,
        bytes calldata _outputTxInclusionProof
    )
        external
        payable
        onlyWithValue(standardExitBond)
    {
        StartStandardExitInputData memory input = StartStandardExitInputData({
            utxoPos: _utxoPos,
            rlpOutputTx: _rlpOutputTx,
            outputType: _outputType,
            outputGuardData: _outputGuardData,
            outputTxInclusionProof: _outputTxInclusionProof
        });

        StartStandardExitData memory data = setupStartStandardExitData(input);
        verifyStartStandardExitData(data);
        saveStandardExitData(data);
        enqueueStandardExit(data);

        emit ExitStarted(data.exitTarget, data.exitId);
    }

    /**
     * @notice Challenge a standard exit by showing the exiting output was spent.
     * @dev Uses struct as input because too many variables and failed to compile.
     * @dev Uses public instead of external because ABIEncoder V2 cannot uses struct calldata + external
     * @param _input input data to challenge. See struct 'ChallengeStandardExitInputData' for detailed param info.
     */
    function challengeStandardExit(ChallengeStandardExitInputData memory _input)
        public
        payable
    {
        ChallengeStandardExitData memory data = ChallengeStandardExitData({
            input: _input,
            exitData: exits[_input.exitId]
        });
        verifyChallengeExitExists(data);
        verifyOutputRelatedDataHash(data);
        verifySpendingCondition(data);

        delete exits[_input.exitId];
        msg.sender.transfer(standardExitBond);

        emit ExitChallenged(_input.outputUtxoPos);
    }

    /**
    Start standard exit helper functions
    */

    function setupStartStandardExitData(StartStandardExitInputData memory input)
        private
        view
        returns (StartStandardExitData memory)
    {
        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(input.utxoPos);
        PaymentTransactionModel.Transaction memory outputTx = PaymentTransactionModel.decode(input.rlpOutputTx);
        PaymentOutputModel.Output memory output = outputTx.outputs[utxoPos.outputIndex()];
        bool isTxDeposit = isDeposit.test(utxoPos.blockNum());
        uint192 exitId = ExitId.getStandardExitId(isTxDeposit, input.rlpOutputTx, utxoPos);
        (bytes32 root, uint256 blockTimestamp) = framework.blocks(utxoPos.blockNum());
        bytes memory outputGuardData = input.outputType == 0 ? bytes("") : input.outputGuardData;

        address payable exitTarget;
        IOutputGuardParser outputGuardParser;
        if (input.outputType == 0) {
            // output type 0 --> output holding owner address directly
            exitTarget = output.owner();
        } else if (input.outputType != 0) {
            outputGuardParser = OutputGuardParserRegistry.outputGuardParsers(input.outputType);
            if (address(outputGuardParser) != address(0)) {
                exitTarget = outputGuardParser.parseExitTarget(outputGuardData);
            }
        }

        return StartStandardExitData({
            input: input,
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

    function verifyStartStandardExitData(StartStandardExitData memory data)
        private
        view
    {
        require(data.output.amount > 0, "Should not exit with amount 0");

        if (data.input.outputType != 0) {
            bytes32 outputGuardFromPreImage = OutputGuard.build(data.input.outputType, data.input.outputGuardData);
            require(data.output.outputGuard == outputGuardFromPreImage, "Output guard data mismatch pre-image");
            require(data.outputGuardParser != address(0), "Failed to get the output guard parser for the output type");
        }

        require(data.exitTarget == msg.sender, "Only exit target can start an exit");
        require(exits[data.exitId].exitable == false, "Exit already started");

        bytes32 leafData = keccak256(data.input.rlpOutputTx);
        require(
            Merkle.checkMembership(
                leafData, data.utxoPos.txIndex(), data.txBlockRoot, data.input.outputTxInclusionProof
            ),
            "transaction inclusion proof failed"
        );
    }

    function saveStandardExitData(StartStandardExitData memory data) private {
        bytes32 outputId = OutputId.compute(
            data.isTxDeposit, data.input.rlpOutputTx, data.utxoPos.outputIndex(), data.utxoPos.value
        );

        bytes32 outputRelatedDataHash = keccak256(
            abi.encodePacked(data.utxoPos.value, outputId, data.input.outputType, data.output.outputGuard)
        );

        exits[data.exitId] = PaymentExitDataModel.StandardExit({
            exitable: true,
            outputRelatedDataHash: outputRelatedDataHash,
            token: data.output.token,
            exitTarget: data.exitTarget,
            amount: data.output.amount
        });
    }

    function enqueueStandardExit(StartStandardExitData memory data) private {
        uint256 exitableAt = exitableTimestampCalculator.calculate(
            block.timestamp, data.txBlockTimeStamp, data.isTxDeposit
        );

        uint192 priority = uint192(data.utxoPos.value);
        ExitModel.Exit memory exitDataForQueue = ExitModel.Exit({
            exitProcessor: address(this),
            exitableAt: exitableAt,
            exitId: data.exitId
        });

        framework.enqueue(priority, data.output.token, exitDataForQueue);
    }

    /**
    Challenge standard exit helper functions
    */

    function verifyChallengeExitExists(ChallengeStandardExitData memory data) private pure {
        require(data.exitData.exitable == true, "Such exit does not exists");
    }

    function verifyOutputRelatedDataHash(ChallengeStandardExitData memory data) private pure {
        ChallengeStandardExitInputData memory input = data.input;
        bytes32 outputRelatedDataHash = keccak256(
            abi.encodePacked(input.outputUtxoPos, input.outputId, input.outputType, input.outputGuard)
        );

        require(data.exitData.outputRelatedDataHash == outputRelatedDataHash,
                "Some of the output related challenge data are invalid for the exit");
    }

    function verifySpendingCondition(ChallengeStandardExitData memory data) private view {
        ChallengeStandardExitInputData memory input = data.input;

        IPaymentSpendingCondition condition = PaymentSpendingConditionRegistry.spendingConditions(
            input.outputType, input.challengeTxType
        );
        require(address(condition) != address(0), "Spending condition contract not found");

        bool isSpentByChallengeTx = condition.verify(
            input.outputGuard,
            input.outputUtxoPos,
            input.outputId,
            input.challengeTx,
            input.inputIndex,
            input.witness
        );
        require(isSpentByChallengeTx, "Spending condition failed");
    }
}
