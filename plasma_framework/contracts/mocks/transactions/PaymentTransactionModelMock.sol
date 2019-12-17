pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/transactions/PaymentTransactionModel.sol";

contract PaymentTransactionModelMock {
    using RLPReader for bytes;

    function decode(bytes memory transaction) public pure returns (PaymentTransactionModel.Transaction memory) {
        return PaymentTransactionModel.decode(transaction);
    }

    function getOutputOwner(uint256 outputType, address owner, address token, uint256 amount) public pure returns (address payable) {
        FungibleTokenOutputModel.Output memory output = FungibleTokenOutputModel.Output({
            outputType: outputType,
            outputGuard: bytes20(owner),
            token: token,
            amount: amount
        });
        return PaymentTransactionModel.getOutputOwner(output);
    }

    function getOutput(bytes memory transaction, uint16 outputIndex) public pure returns (FungibleTokenOutputModel.Output memory) {
        PaymentTransactionModel.Transaction memory decodedTx = PaymentTransactionModel.decode(transaction);
        return PaymentTransactionModel.getOutput(decodedTx, outputIndex);
    }
}
