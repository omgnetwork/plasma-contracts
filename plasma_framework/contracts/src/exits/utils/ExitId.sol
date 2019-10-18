pragma solidity 0.5.11;

import "./OutputId.sol";
import "../../utils/Bits.sol";
import "../../utils/UtxoPosLib.sol";

library ExitId {
    using UtxoPosLib for UtxoPosLib.UtxoPos;
    using Bits for uint160;
    using Bits for uint256;

    /**
     * @notice Checks whether exitId is a standard exit id or not.
     */
    function isStandardExit(uint160 _exitId) internal pure returns (bool) {
        return _exitId.getBit(159) == 0;
    }

    /**
     * @notice Given transaction bytes and UTXO position, returns its exit ID.
     * @dev Id from a deposit is computed differently from any other tx due to the fact that txBytes of deposit tx can be not unique.
     * @notice Output index must be within range 0 - 255.
     * @param _isDeposit whether the tx for the exitId is an deposit tx or not
     * @param _txBytes Transaction bytes.
     * @param _utxoPos UTXO position of the exiting output.
     * @return _standardExitId Unique standard exit id.
     *     Anatomy of returned value, most significant bits first:
     *     1-bit - in-flight flag (0 for standard exit)
     *     159-bits - left most 159 bits of the outputId of the exiting output
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
        bytes32 outputId;
        if (_isDeposit) {
            outputId = OutputId.computeDepositOutputId(_txBytes, _utxoPos.outputIndex(), _utxoPos.value);
        } else {
            outputId = OutputId.computeNormalOutputId(_txBytes, _utxoPos.outputIndex());
        }

        return uint160(uint256(outputId) >> (256 - 159));
    }

    /**
    * @notice Given transaction bytes returns in-flight exit ID.
    * @param _txBytes Transaction bytes.
    * @return Unique in-flight exit id.
    *     Anatomy of returned value, most significant bits first:
    *     1-bit - in-flight flag (0 for standard exit)
    *     159-bits - left most 159 bits of the tx hash of exiting tx
    */
    function getInFlightExitId(bytes memory _txBytes) internal pure returns (uint160) {
        return uint160((uint256(keccak256(_txBytes)) >> (256 - 159)).setBit(159));
    }
}
