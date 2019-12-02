pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/transactions/WireTransaction.sol";

contract WireTransactionWrapper {

    function getOutput(bytes memory transaction, uint16 outputIndex) public pure returns (WireTransaction.Output memory) {
        WireTransaction.Transaction memory wtx = WireTransaction.decode(transaction);
        return WireTransaction.getOutput(wtx, outputIndex);
    }

    function getTransactionType(bytes memory transaction) public pure returns (uint256) {
        WireTransaction.Transaction memory wtx = WireTransaction.decode(transaction);
        return wtx.txType;
    }
}
