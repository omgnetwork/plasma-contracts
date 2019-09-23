pragma solidity 0.5.11;

interface IPaymentSpendingCondition {
    /**
     * @notice Checks output spending condition.
     * @param _outputGuard OutputGuard of the output.
     * @param _utxoPos (optional) serves as the identifier of output. Only one of utxoPos or outputId must be set.
     * @param _outputId (optional) serves as the identifier of output. Only one of utxoPos or outputId must be set.
     * @param _spendingTx The transaction that spends the output.
     * @param _inputIndex The input index of the spending transaction that points to the output.
     * @param _witness Witness data proving the output can be spent.
     */
    function verify(
        bytes32 _outputGuard,
        uint256 _utxoPos,
        bytes32 _outputId,
        bytes calldata _spendingTx,
        uint16 _inputIndex,
        bytes calldata _witness
    ) external view returns (bool);
}
