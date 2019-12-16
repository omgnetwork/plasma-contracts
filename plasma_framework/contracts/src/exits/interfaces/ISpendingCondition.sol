pragma solidity 0.5.11;

/**
 * @notice Interface of the spending condition
 * @dev For the interface design and discussion, see the following GH issue
 *      https://github.com/omisego/plasma-contracts/issues/214
 */
interface ISpendingCondition {

    /**
     * @notice Verifies the spending condition
     * @param inputTx Encoded input transaction, in bytes
     * @param utxoPos Position of the utxo
     * @param spendingTx Spending transaction, in bytes
     * @param inputIndex The input index of the spending tx that points to the output
     * @param witness The witness data of the spending condition
     */
    function verify(
        bytes calldata inputTx,
        uint256 utxoPos,
        bytes calldata spendingTx,
        uint16 inputIndex,
        bytes calldata witness
    ) external view returns (bool);
}
