pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/transactions/PaymentTransactionModel.sol";

contract PaymentTransactionModelMock {
    using RLPReader for bytes;

    function decode(bytes memory transaction) public pure returns (PaymentTransactionModel.Transaction memory) {
        return PaymentTransactionModel.decode(transaction);
    }

    function decodeOutput(bytes memory output) public pure returns (GenericTransaction.Output memory) {
        return PaymentTransactionModel.decodeOutput(output.toRlpItem());
    }

    function getOutputOwner(uint256 outputType, address owner, address token, uint256 amount) public pure returns (address payable) {
        GenericTransaction.Output memory output = GenericTransaction.Output({
            outputType: outputType,
            outputGuard: bytes20(owner),
            token: token,
            amount: amount
        });
        return PaymentTransactionModel.getOutputOwner(output);
    }
}
