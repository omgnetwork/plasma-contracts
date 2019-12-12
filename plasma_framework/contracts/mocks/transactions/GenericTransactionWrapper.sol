pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/transactions/GenericTransaction.sol";

contract GenericTransactionWrapper {

    function decode(bytes memory transaction) public pure returns (GenericTransaction.Transaction memory) {
        return GenericTransaction.decode(transaction);
    }

    function getOutput(bytes memory transaction, uint16 outputIndex) public pure returns (GenericTransaction.Output memory) {
        GenericTransaction.Transaction memory genericTx = GenericTransaction.decode(transaction);
        return GenericTransaction.getOutput(genericTx, outputIndex);
    }
}
