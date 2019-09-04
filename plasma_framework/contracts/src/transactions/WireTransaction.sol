pragma solidity ^0.5.0;

import "../utils/RLP.sol";

/**
 * @title WireTransaction
 * @dev Utility functions for working with transactions in wire format.
 */
library WireTransaction {

    using RLP for bytes;
    using RLP for RLP.RLPItem;

    struct Output {
        uint256 amount;
        bytes32 outputGuard;
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
        uint256 amount = output[0].toUint();
        bytes32 outputGuard = output[1].toBytes32();
        address token = output[2].toAddress();

        return Output(amount, outputGuard, token);
    }
}
