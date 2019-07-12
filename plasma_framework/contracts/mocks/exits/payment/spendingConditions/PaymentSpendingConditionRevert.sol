pragma solidity ^0.5.0;

import "../../../../src/exits/payment/spendingConditions/IPaymentSpendingCondition.sol";

contract PaymentSpendingConditionRevert is IPaymentSpendingCondition {
    string constant public revertMessage = "testing payment spending condition reverts";

    function verify(
        bytes32,
        uint256,
        bytes32,
        bytes calldata,
        uint8,
        bytes calldata
    ) external view returns (bool) {
        require(false, revertMessage);
    }
}
