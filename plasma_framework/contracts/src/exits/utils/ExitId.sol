pragma solidity 0.5.11;

import "../../utils/Bits.sol";
import "../../utils/UtxoPosLib.sol";

library ExitId {
    using UtxoPosLib for UtxoPosLib.UtxoPos;
    using Bits for uint160;
    using Bits for uint256;

    /**
     * @notice Checks whether exitId is a standard exit ID
     */
    function isStandardExit(uint160 _exitId) internal pure returns (bool) {
        return _exitId.getBit(151) == 0;
    }

    /**
     * @notice Given transaction bytes and UTXO position, returns its exit ID
     * @dev Computation of a depost ID is different to any other tx because txBytes of a deposit tx can be a non-unique value
     * @notice Output index must be within range 0 - 255
     * @param _isDeposit Defines whether the tx for the exitId is a deposit tx
     * @param _txBytes Transaction bytes
     * @param _utxoPos UTXO position of the exiting output
     * @return _standardExitId Unique ID of the standard exit
     *     Anatomy of returned value, most significant bits first:
     *     8-bits - output index
     *     1-bit - in-flight flag (0 for standard exit)
     *     151-bits - hash(tx) or hash(tx|utxo) for deposit
     */
    function getStandardExitId(
        bool _isDeposit,
        bytes memory _txBytes,
        UtxoPosLib.UtxoPos memory _utxoPos
    )
        internal
        pure
        returns (uint160)
    {
        if (_isDeposit) {
            bytes32 hashData = keccak256(abi.encodePacked(_txBytes, _utxoPos.value));
            return _computeStandardExitId(hashData, _utxoPos.outputIndex());
        }

        return _computeStandardExitId(keccak256(_txBytes), _utxoPos.outputIndex());
    }

    /**
    * @notice Given transaction bytes, returns in-flight exit ID
    * @param _txBytes Transaction bytes
    * @return Unique in-flight exit ID
    */
    function getInFlightExitId(bytes memory _txBytes) internal pure returns (uint160) {
        return uint160((uint256(keccak256(_txBytes)) >> 105).setBit(151));
    }

    function _computeStandardExitId(bytes32 _txhash, uint16 _outputIndex)
        private
        pure
        returns (uint160)
    {
        uint256 exitId = (uint256(_txhash) >> 105) | (uint256(_outputIndex) << 152);
        uint160 croppedExitId = uint160(exitId);

        require(uint256(croppedExitId) == exitId, "ExitId overflows");

        return croppedExitId;
    }
}
