pragma solidity 0.5.11;

interface ISpendingCondition {

    /**
     * @notice Verifies the spending condition
     * @param inputTx encoded input transaction in bytes
     * @param outputIndex the output index of the input transaction
     * @param inputTxPos the tx position of the input tx. (0 if in-flight)
     * @param spendingTx spending transaction in bytes
     * @param inputIndex the input index of the spending tx that points to the output
     * @param witness the witness data of the spending condition
     * @param optionalArgs some optional data for the spending condition's need (eg. output guard preimage)
     */
    function verify(
        bytes calldata inputTx,
        uint16 outputIndex,
        uint256 inputTxPos,
        bytes calldata spendingTx,
        uint16 inputIndex,
        bytes calldata witness,
        bytes calldata optionalArgs
    ) external view returns (bool);
}
