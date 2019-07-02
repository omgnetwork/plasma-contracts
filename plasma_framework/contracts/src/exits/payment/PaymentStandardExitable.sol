pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./PaymentExitDataModel.sol";
import "../utils/ExitId.sol";
import "../utils/ExitableTimestamp.sol";
import "../../framework/interfaces/IPlasmaFramework.sol";
import "../../framework/models/ExitModel.sol";
import "../../utils/IsDeposit.sol";
import "../../utils/OnlyWithValue.sol";
import "../../utils/TxPosLib.sol";
import "../../utils/UtxoPosLib.sol";
import "../../utils/Merkle.sol";
import "../../transactions/PaymentTransactionModel.sol";
import "../../transactions/outputs/PaymentOutputModel.sol";

contract PaymentStandardExitable is OnlyWithValue {
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

    /**
    @dev data to be passed around startStandardExit helper functions
     */
    struct StartStandardExitData {
        UtxoPosLib.UtxoPos utxoPos;
        PaymentTransactionModel.Transaction outputTx;
        PaymentOutputModel.Output output;
        uint192 exitId;
        bool isTxDeposit;
        bytes txInclusionProof;
        bytes rlpTx;
        bytes32 txBlockRoot;
        uint256 txBlockTimeStamp;
    }

    event ExitStarted(
        address indexed owner,
        uint192 exitId
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
     * @param _outputTx RLP encoded transaction that created the exiting output.
     * @param _outputTxInclusionProof A Merkle proof showing that the transaction was included.
     */
    function startStandardExit(
        uint192 _utxoPos,
        bytes calldata _outputTx,
        bytes calldata _outputTxInclusionProof
    )
        external
        payable
        onlyWithValue(standardExitBond)
    {
        StartStandardExitData memory data = setupStartStandardExitData(_utxoPos, _outputTx, _outputTxInclusionProof);
        verifyStartStandardExitData(data);
        saveStandardExitData(data);
        enqueueStandardExit(data);

        emit ExitStarted(data.output.owner(), data.exitId);
    }

    /**
    Private functions
    */

    function setupStartStandardExitData(
        uint192 _utxoPos,
        bytes memory _outputTx,
        bytes memory _txInclusionProof
    )
        private
        view
        returns (StartStandardExitData memory)
    {
        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(_utxoPos);
        PaymentTransactionModel.Transaction memory outputTx = PaymentTransactionModel.decode(_outputTx);
        PaymentOutputModel.Output memory output = outputTx.outputs[utxoPos.outputIndex()];
        bool isTxDeposit = isDeposit.test(utxoPos.blockNum());
        uint192 exitId = ExitId.getStandardExitId(isTxDeposit, _outputTx, utxoPos);
        (bytes32 root, uint256 blockTimestamp) = framework.blocks(utxoPos.blockNum());

        return StartStandardExitData({
            utxoPos: utxoPos,
            outputTx: outputTx,
            output: output,
            exitId: exitId,
            isTxDeposit: isTxDeposit,
            txInclusionProof: _txInclusionProof,
            rlpTx: _outputTx,
            txBlockRoot: root,
            txBlockTimeStamp: blockTimestamp
        });
    }

    function verifyStartStandardExitData(StartStandardExitData memory data)
        private
        view
    {
        bytes32 leafData = keccak256(data.rlpTx);
        require(
            Merkle.checkMembership(leafData, data.utxoPos.txIndex(), data.txBlockRoot, data.txInclusionProof),
            "transaction inclusion proof failed"
        );
        require(data.output.amount > 0, "Should not exit with amount 0");
        require(data.output.owner() == msg.sender, "Only output owner can start an exit");
        require(exits[data.exitId].exitable == false, "Exit already started");
    }

    function saveStandardExitData(StartStandardExitData memory data) private {
        PaymentExitDataModel.StandardExit memory exitData = PaymentExitDataModel.StandardExit({
            exitable: true,
            position: uint192(data.utxoPos.value),
            token: data.output.token,
            exitTarget: data.output.owner(),
            amount: data.output.amount
        });
        exits[data.exitId] = exitData;
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
}
