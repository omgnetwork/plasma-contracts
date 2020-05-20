pragma solidity 0.5.11;

import "../../utils/Bits.sol";
import "../../utils/PosLib.sol";

library ExitId {
    using PosLib for PosLib.Position;
    using Bits for uint168;
    using Bits for uint256;

    uint8 constant internal FIRST_BIT = 167;

    /**
     * @notice Checks whether exitId is a standard exit ID
     */
    function isStandardExit(uint168 _exitId) internal pure returns (bool) {
        return _exitId.getBit(FIRST_BIT) == 0;
    }

    /**
     * @notice Given transaction bytes and UTXO position, returns its exit ID
     * @dev Computation of a deposit ID is different to any other tx because txBytes of a deposit tx can be a non-unique value
     * @param _isDeposit Defines whether the tx for the exitId is a deposit tx
     * @param _txBytes Transaction bytes
     * @param _utxoPos UTXO position of the exiting output
     * @return _standardExitId Unique ID of the standard exit
     *     Anatomy of returned value, most significant bits first:
     *     1-bit - in-flight flag (0 for standard exit)
     *     167-bits - hash(tx) or hash(tx|utxo) for deposit
     */
    function getStandardExitId(
        bool _isDeposit,
        bytes memory _txBytes,
        PosLib.Position memory _utxoPos
    )
        internal
        pure
        returns (uint168)
    {
        if (_isDeposit) {
            bytes32 hashData = keccak256(abi.encodePacked(_txBytes, _utxoPos.encode()));
            return _computeStandardExitId(hashData);
        }

        return _computeStandardExitId(keccak256(_txBytes));
    }

    /**
    * @notice Given transaction bytes, returns in-flight exit ID
    * @param _txBytes Transaction bytes
    * @return Unique in-flight exit ID
    */
    function getInFlightExitId(bytes memory _txBytes) internal pure returns (uint168) {
        return uint168((uint256(keccak256(_txBytes)) >> (256 - FIRST_BIT)).setBit(FIRST_BIT));
    }

    function _computeStandardExitId(bytes32 _txhash) private pure returns (uint168) {
        return uint168((uint256(_txhash) >> (256 - FIRST_BIT)));
    }
}
