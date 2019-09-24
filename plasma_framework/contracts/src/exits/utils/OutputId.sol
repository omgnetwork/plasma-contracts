pragma solidity ^0.5.0;

library OutputId {
    /**
     * @notice Computes the output id for deposit tx
     * @dev Deposit tx bytes might not be unique because all inputs are empty.
     *      Two deposits with the same output value would result in the same tx bytes.
     *      As a result, we need to hash with utxoPos to ensure uniqueness.
     * @param _txBytes Transaction bytes.
     * @param _outputIndex output index of the output.
     * @param _utxoPosValue (optinal) UTXO position of the deposit output.
     */
    function computeDepositOutputId(bytes memory _txBytes, uint256 _outputIndex, uint256 _utxoPosValue)
        internal
        pure
        returns(bytes32)
    {
        return keccak256(abi.encodePacked(_txBytes, _outputIndex, _utxoPosValue));
    }

    /**
     * @notice Computes the output id for normal (non deposit) tx
     * @dev Since txBytes for non-deposit tx is unique, directly hash the txBytes with outputIndex.
     * @param _txBytes Transaction bytes.
     * @param _outputIndex output index of the output.
     */
    function computeNormalOutputId(bytes memory _txBytes, uint256 _outputIndex)
        internal
        pure
        returns(bytes32)
    {
        return keccak256(abi.encodePacked(_txBytes, _outputIndex));
    }
}
