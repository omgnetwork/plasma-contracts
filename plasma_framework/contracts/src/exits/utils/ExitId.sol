pragma solidity 0.5.11;

import "../../utils/Bits.sol";
import "../../utils/UtxoPosLib.sol";

library ExitId {
    using UtxoPosLib for UtxoPosLib.UtxoPos;
    using Bits for uint192;
    using Bits for uint256;

    function isStandardExit(uint192 _exitId) internal pure returns (bool) {
        return _exitId.getBit(151) == 0;
    }

    /**
     * @notice Given transaction bytes and UTXO position, returns its exit ID.
     * @dev Id from a deposit is computed differently from any other tx.
     * @param _isDeposit Predicate to check whether a block num is a deposit block.
     * @param _txBytes Transaction bytes.
     * @param _utxoPos UTXO position of the exiting output.
     * @return _standardExitId Unique standard exit id.
     *     Anatomy of returned value, most significant bits first:
     *     16 bits - output index
     *     1 bit - in-flight flag (0 for standard exit)
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
    * @notice Given transaction bytes returns in-flight exit ID.
    * @param _txBytes Transaction bytes.
    * @return Unique in-flight exit id.
    */
    function getInFlightExitId(bytes memory _txBytes) internal pure returns (uint192) {
        return uint192((uint256(keccak256(_txBytes)) >> 105).setBit(151));
    }

    /**
    Private
    */
    function _computeStandardExitId(bytes32 _txhash, uint16 _outputIndex)
        private
        pure
        returns (uint192)
    {
        return uint192((uint256(_txhash) >> 105) | (uint256(_outputIndex) << 152));
    }
}
