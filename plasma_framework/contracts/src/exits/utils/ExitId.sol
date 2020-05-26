pragma solidity 0.5.11;

import "../../utils/Bits.sol";
import "../../utils/PosLib.sol";
import "./OutputId.sol";

library ExitId {
    using PosLib for PosLib.Position;
    using Bits for uint168;
    using Bits for uint256;

    uint8 constant private FIRST_BIT_LOCATION = 167;

    /**
     * @notice Checks whether exitId is a standard exit ID
     */
    function isStandardExit(uint168 exitId) internal pure returns (bool) {
        return exitId.getBit(FIRST_BIT_LOCATION) == 0;
    }

    /**
     * @notice Given transaction bytes and UTXO position, returns its exit ID
     * @dev Computation of a deposit ID is different to any other tx because txBytes of a deposit tx can be a non-unique value
     * @param isDeposit Defines whether the tx for the exitId is a deposit tx
     * @param txBytes Transaction bytes
     * @param utxoPos UTXO position of the exiting output
     * @return standardExitId Unique ID of the standard exit
     *     Anatomy of returned value, most significant bits first:
     *     1-bit - in-flight flag (0 for standard exit)
     *     167-bits - hash(tx) or hash(tx|utxo) for deposit
     */
    function getStandardExitId(
        bool isDeposit,
        bytes memory txBytes,
        PosLib.Position memory utxoPos
    )
        internal
        pure
        returns (uint168)
    {
        bytes32 outputId;
        if (isDeposit) {
            outputId = OutputId.computeDepositOutputId(txBytes, utxoPos.outputIndex, utxoPos.encode());
        } else {
            outputId = OutputId.computeNormalOutputId(txBytes, utxoPos.outputIndex);
        }

        return uint168((uint256(outputId) >> (256 - FIRST_BIT_LOCATION)));
    }

    /**
    * @notice Given transaction bytes, returns in-flight exit ID
    * @param txBytes Transaction bytes
    * @return Unique in-flight exit ID
    */
    function getInFlightExitId(bytes memory txBytes) internal pure returns (uint168) {
        return uint168((uint256(keccak256(txBytes)) >> (256 - FIRST_BIT_LOCATION)).setBit(FIRST_BIT_LOCATION));
    }
}
