pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../PaymentInFlightExitModelUtils.sol";
import "../routers/PaymentInFlightExitRouterArgs.sol";
import "../spendingConditions/IPaymentSpendingCondition.sol";
import "../spendingConditions/PaymentSpendingConditionRegistry.sol";
import "../../utils/ExitId.sol";
import "../../../utils/UtxoPosLib.sol";
import "../../../utils/Merkle.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../transactions/PaymentTransactionModel.sol";

library PaymentChallengeIFEInputSpent {
    using UtxoPosLib for UtxoPosLib.UtxoPos;
    using PaymentInFlightExitModelUtils for PaymentExitDataModel.InFlightExit;

    // TODO: Use BondSize lib.
    uint256 public constant PIGGYBACK_BOND = 31415926535 wei;

    struct Controller {
        PlasmaFramework framework;
        PaymentSpendingConditionRegistry spendingConditionRegistry;
        uint256 supportedTxType;
    }

    event InFlightExitInputBlocked(
        address indexed challenger,
        bytes32 txHash,
        uint8 inputIndex
    );

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
            keccak256(args.inFlightTx) != keccak256(args.spendingTx),
            "The spending transaction is the same as the in-flight transaction"
        );

        PaymentTransactionModel.Transaction memory spendingTx = PaymentTransactionModel.decode(args.spendingTx);
        require(args.spendingTxInputIndex < spendingTx.inputs.length, "Incorrect spending transaction input index");

        bytes32 spendingInput = spendingTx.inputs[args.spendingTxInputIndex];
        bytes32 ifeInput = PaymentTransactionModel.decode(args.inFlightTx).inputs[args.inFlightTxInputIndex];
        require(ifeInput == spendingInput, "Spent input is not the same as piggybacked input");

        IPaymentSpendingCondition condition = self.spendingConditionRegistry.spendingConditions(
            args.spendingTxInputOutputType, spendingTx.txType
        );
        require(address(condition) != address(0), "Spending condition contract not found");

        // FIXME: move to the finalized interface as https://github.com/omisego/plasma-contracts/issues/214
        // Also, the tests should verify the args correctness
        bool isSpentByInFlightTx = condition.verify(
            bytes32(""), // tmp solution, we don't need outputGuard anymore for the interface of :point-up: GH-214
            uint256(0), // should not be used
            ife.inputs[args.inFlightTxInputIndex].outputId,
            args.spendingTx,
            args.spendingTxInputIndex,
            args.spendingTxWitness
        );
        require(isSpentByInFlightTx, "Spent input spending condition is not met");

        // Remove the input from the piggyback map
        ife.clearInputPiggybacked(args.inFlightTxInputIndex);

        // Pay out the bond.
        msg.sender.transfer(PIGGYBACK_BOND);

        emit InFlightExitInputBlocked(msg.sender, keccak256(args.inFlightTx), args.inFlightTxInputIndex);
    }
}
