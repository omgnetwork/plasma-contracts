pragma solidity ^0.5.0;

import "../../utils/UtxoPosLib.sol";
import "../../framework/interfaces/IPlasmaFramework.sol";

library ExitId {
    using UtxoPosLib for UtxoPosLib.UtxoPos;

    /**
     * @notice Given transaction bytes and UTXO position, returns its exit ID.
     * @dev Id from a deposit is computed differently from any other tx.
     * @param _isDeposit Predicate to check whether a block num is a deposit block.
     * @param _txBytes Transaction bytes.
     * @param _utxoPos UTXO position of the exiting output.
     * @return _standardExitId Unique standard exit id.
     *     Anatomy of returned value, most significant bits first:
     *     8 bits - oindex
     *     1 bit - in-flight flag
     *     151 bit - hash(tx) or hash(tx|utxo) for deposit
     */
    function getStandardExitId(
        bool _isDeposit,
        bytes memory _txBytes,
        UtxoPosLib.UtxoPos memory _utxoPos
    )
        internal
        pure
        returns (uint192)
    {
        if (_isDeposit) {
            bytes32 hashData = keccak256(abi.encodePacked(_txBytes, _utxoPos.value));
            return _computeStandardExitId(hashData, _utxoPos.outputIndex());
        }

        return _computeStandardExitId(keccak256(_txBytes), _utxoPos.outputIndex());
    }

    /**
    Private
    */

    function _computeStandardExitId(bytes32 _txhash, uint8 _outputIndex)
        private
        pure
        returns (uint192)
    {
        return uint192((uint256(_txhash) >> 105) | (uint256(_outputIndex) << 152));
    }
}
