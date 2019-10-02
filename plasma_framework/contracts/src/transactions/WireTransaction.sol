pragma solidity 0.5.11;

import "../utils/RLP.sol";

/**
 * @title WireTransaction
 * @dev Utility functions for working with transactions in wire format.
 */
library WireTransaction {

    using RLP for bytes;
    using RLP for RLP.RLPItem;

    struct Output {
        uint256 outputType;
        uint256 amount;
        bytes20 outputGuard;
        address token;
    }

    /**
    * @dev Returns output for transaction in wire format.
    * Outputs is a field on the second index and should be a list where first three elements are: amount, output guard, token.
    */
    function getOutput(bytes memory transaction, uint16 outputIndex) internal pure returns (Output memory) {
        RLP.RLPItem[] memory rlpTx = transaction.toRLPItem().toList();
        RLP.RLPItem[] memory outputs = rlpTx[2].toList();
        require(outputIndex < outputs.length, "Invalid wire transaction format");

        RLP.RLPItem[] memory output = outputs[outputIndex].toList();
        uint256 outputType = output[0].toUint();
        bytes20 outputGuard = bytes20(output[1].toAddress());
        address token = output[2].toAddress();
        uint256 amount = output[3].toUint();

        return Output(outputType, amount, outputGuard, token);
    }

    /**
    * @dev Returns transaction type for transaction in wire format.
    * Transaction type is the value of first field in rlp encoded list.
    */
    function getTransactionType(bytes memory transaction) internal pure returns (uint256) {
        RLP.RLPItem[] memory rlpTx = transaction.toRLPItem().toList();
        return rlpTx[0].toUint();
    }
}
