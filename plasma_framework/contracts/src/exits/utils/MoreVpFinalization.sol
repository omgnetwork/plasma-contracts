pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../framework/PlasmaFramework.sol";
import "../../framework/Protocol.sol";
import "../../utils/Merkle.sol";
import "../../utils/TxPosLib.sol";

/**
 * @notice Library to check finalization for MoreVP protocol
 */
library MoreVpFinalization {
    using TxPosLib for TxPosLib.TxPos;

    /**
    * @notice Checks whether a transaction is "standard finalized".
    *         For MoreVP, it means the transaction should be included in a plasma block.
    */
    function isStandardFinalized(
        PlasmaFramework framework,
        bytes memory txBytes,
        TxPosLib.TxPos memory txPos,
        bytes memory inclusionProof
    )
        internal
        view
        returns (bool)
    {
        (bytes32 root,) = framework.blocks(txPos.blockNum());
        require(root != bytes32(""), "Failed to get the root hash of the block num");

        if (inclusionProof.length == 0) {
            return false;
        }

        return Merkle.checkMembership(
            txBytes, txPos.txIndex(), root, inclusionProof
        );
    }

    /**
    * @notice Checks whether a transaction is "protocol finalized"
    *         For MoreVP, since it allows in-flight tx, so only checks for the existence of the transaction
    */
    function isProtocolFinalized(bytes memory txBytes) internal pure returns (bool) {
        return txBytes.length > 0;
    }
}
