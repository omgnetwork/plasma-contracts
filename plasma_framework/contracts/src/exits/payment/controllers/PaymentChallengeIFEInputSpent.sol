pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../PaymentInFlightExitModelUtils.sol";
import "../routers/PaymentInFlightExitRouterArgs.sol";
import "../../interfaces/ISpendingCondition.sol";
import "../../registries/SpendingConditionRegistry.sol";
import "../../utils/ExitId.sol";
import "../../utils/OutputId.sol";
import "../../../utils/UtxoPosLib.sol";
import "../../../utils/IsDeposit.sol";
import "../../../utils/Merkle.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../transactions/PaymentTransactionModel.sol";

library PaymentChallengeIFEInputSpent {
    using UtxoPosLib for UtxoPosLib.UtxoPos;
    using IsDeposit for IsDeposit.Predicate;
    using PaymentInFlightExitModelUtils for PaymentExitDataModel.InFlightExit;

    // TODO: Use BondSize lib.
    uint256 public constant PIGGYBACK_BOND = 31415926535 wei;

    struct Controller {
        PlasmaFramework framework;
        IsDeposit.Predicate isDeposit;
        SpendingConditionRegistry spendingConditionRegistry;
        uint256 supportedTxType;
    }

    event InFlightExitInputBlocked(
        address indexed challenger,
        bytes32 txHash,
        uint8 inputIndex
    );

    /**
     * @dev data to be passed around helper functions
     */
    struct ChallengeIFEData {
        Controller controller;
        PaymentInFlightExitRouterArgs.ChallengeInputSpentArgs args;
        PaymentExitDataModel.InFlightExit ife;
    }

    function buildController(
        PlasmaFramework framework,
        SpendingConditionRegistry spendingConditionRegistry,
        uint256 supportedTxType
    )
        public
        view
        returns (Controller memory)
    {
        return Controller({
            framework: framework,
            isDeposit: IsDeposit.Predicate(framework.CHILD_BLOCK_INTERVAL()),
            spendingConditionRegistry: spendingConditionRegistry,
            supportedTxType: supportedTxType
        });
    }

    function run(
        Controller memory self,
        PaymentExitDataModel.InFlightExitMap storage inFlightExitMap,
        PaymentInFlightExitRouterArgs.ChallengeInputSpentArgs memory args
    )
        public
    {
        uint192 exitId = ExitId.getInFlightExitId(args.inFlightTx);
        PaymentExitDataModel.InFlightExit storage ife = inFlightExitMap.exits[exitId];

        require(ife.exitStartTimestamp != 0, "In-flight exit doesn't exist");
        require(ife.isInputPiggybacked(args.inFlightTxInputIndex), "The indexed input has not been piggybacked");

        require(
            keccak256(args.inFlightTx) != keccak256(args.challengingTx),
            "The challenging transaction is the same as the in-flight transaction"
        );

        ChallengeIFEData memory data = ChallengeIFEData({
            controller: self,
            args: args,
            ife: inFlightExitMap.exits[exitId]
        });

        verifySpentInputEqualsIFEInput(data);

        verifySpendingCondition(data);

        // Remove the input from the piggyback map
        ife.clearInputPiggybacked(args.inFlightTxInputIndex);

        // Pay out the bond.
        msg.sender.transfer(PIGGYBACK_BOND);

        emit InFlightExitInputBlocked(msg.sender, keccak256(args.inFlightTx), args.inFlightTxInputIndex);
    }

    function verifySpentInputEqualsIFEInput(ChallengeIFEData memory data) private pure {
        bytes32 ifeInputOutputId = data.ife.inputs[data.args.inFlightTxInputIndex].outputId;

        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.build(TxPosLib.TxPos(data.args.inputTxPos), data.args.inputTxOutputIndex);
        bytes32 challengingTxInputOutputId = data.controller.isDeposit.test(utxoPos.blockNum())
                ? OutputId.computeDepositOutputId(data.args.inputTx, utxoPos.outputIndex(), utxoPos.value)
                : OutputId.computeNormalOutputId(data.args.inputTx, utxoPos.outputIndex());

        require(ifeInputOutputId == challengingTxInputOutputId, "Spent input is not the same as piggybacked input");
    }

    function verifySpendingCondition(ChallengeIFEData memory data) private view {
        ISpendingCondition condition = data.controller.spendingConditionRegistry.spendingConditions(
            data.args.challengingTxInputOutputType, data.args.challengingTxType
        );
        require(address(condition) != address(0), "Spending condition contract not found");

        bool isSpent = condition.verify(
            data.args.inputTx,
            data.args.inputTxOutputIndex,
            data.args.inputTxPos,
            data.args.challengingTx,
            data.args.challengingTxInputIndex,
            data.args.challengingTxWitness,
            data.args.spendingConditionOptionalArgs
        );
        require(isSpent, "Spending condition failed");
    }
}
