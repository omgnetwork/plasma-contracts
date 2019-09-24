pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/transactions/PaymentTransactionModel.sol";

contract PaymentTransactionModelMock {

    function decode(bytes memory _transaction) public pure returns (PaymentTransactionModel.Transaction memory) {
        PaymentTransactionModel.Transaction memory transaction = PaymentTransactionModel.decode(_transaction);
        return transaction;
    }

}
