pragma solidity ^0.5.0;

interface IPaymentSpendingCondition {
    /**
     * @notice The function that checks output spending condition via authenticate owner.
     * @param _outputGuard OutputGuard of the output.
     * @param _utxoPos (optional) serves as the identifier of output. One of utxoPos and outputId must be with value.
     * @param _outputId (optional) serves as the identifier of output. One of utxoPos and outputId must be with value.
     * @param _consumeTx The transaction that consumes the output.
     * @param _inputIndex The input index of the consume transaction that points to the output.
     * @param _witness Witness data that would be able to prove that output is able to be consumed.
     */
    function verify(
        bytes32 _outputGuard,
        uint256 _utxoPos,
        bytes32 _outputId,
        bytes calldata _consumeTx,
        uint8 _inputIndex,
        bytes calldata _witness
    ) external view returns (bool);
}
