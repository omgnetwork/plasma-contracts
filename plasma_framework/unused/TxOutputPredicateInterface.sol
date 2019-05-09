pragma solidity ^0.4.0;

interface TxOutputPredicate {
    /**
     * @dev Checks whether a output can be used in next tx.
     * @param _txOutput tx output data.
     * @param _consumeTx tx that consumes the targeting tx output.
     */
    function canUseTxOutput(bytes _txOutput, bytes _consumeTx) external returns (bool);
}