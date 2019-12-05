pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/transactions/GenericTransaction.sol";

contract GenericTransactionWrapper {

    function getOutput(bytes memory transaction, uint16 outputIndex) public pure returns (GenericTransaction.Output memory) {
        GenericTransaction.Transaction memory genericTx = GenericTransaction.decode(transaction);
        return GenericTransaction.getOutput(genericTx, outputIndex);
    }

    function getTransactionType(bytes memory transaction) public pure returns (uint256) {
        GenericTransaction.Transaction memory genericTx = GenericTransaction.decode(transaction);
        return genericTx.txType;
    }
}
