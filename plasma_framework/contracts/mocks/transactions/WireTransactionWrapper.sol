pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/transactions/WireTransaction.sol";

contract WireTransactionWrapper {

    function getOutput(bytes memory transaction, uint16 outputIndex) public pure returns (WireTransaction.Output memory) {
        WireTransaction.Output memory output = WireTransaction.getOutput(transaction, outputIndex);
        return output;
    }

    function getTransactionType(bytes memory transaction) public pure returns (uint256) {
        return WireTransaction.getTransactionType(transaction);
    }
}
