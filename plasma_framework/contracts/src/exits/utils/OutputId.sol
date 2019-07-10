pragma solidity ^0.5.0;

library OutputId {

    /**
     * @notice Computes the output id of an output
     * @dev Id for a deposit output is computed differently from any other outputs.
     * @param _isDeposit boolean value representing the output is from a deposit tx or not
     * @param _txBytes Transaction bytes.
     * @param _outputIndex output index of the output.
     * @param _utxoPosValue (optinal) UTXO position of the deposit output.
     */
    function compute(
        bool _isDeposit,
        bytes memory _txBytes,
        uint256 _outputIndex,
        uint256 _utxoPosValue
    )
        internal
        pure
        returns (bytes32)
    {
        // Deposit tx bytes might not be unique because all inputs are empty.
        // Other tx relies on the fact that input would point to a unique output identifier (utxo_pos or output_id).
        // As a result need to add utxo position value into the hash.
        if (_isDeposit) {
            return keccak256(abi.encodePacked(_txBytes, _outputIndex, _utxoPosValue));
        }

        return keccak256(abi.encodePacked(_txBytes, _outputIndex));
    }
}
