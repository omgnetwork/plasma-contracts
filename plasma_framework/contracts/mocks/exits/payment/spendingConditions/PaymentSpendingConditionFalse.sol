pragma solidity ^0.5.0;

import "../../../../src/exits/payment/spendingConditions/IPaymentSpendingCondition.sol";

contract PaymentSpendingConditionFalse is IPaymentSpendingCondition {
    function verify(
        bytes32,
        uint256,
        bytes32,
        bytes calldata,
        uint8,
        bytes calldata
    ) external view returns (bool) {
        return false;
    }
}
