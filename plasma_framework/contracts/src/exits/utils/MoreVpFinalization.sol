pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../framework/PlasmaFramework.sol";
import "../../framework/Protocol.sol";
import "../../utils/Merkle.sol";
import "../../utils/PosLib.sol";
import "../../transactions/GenericTransaction.sol";

/**
 * @notice Library to check finalization for MoreVP protocol
 * @dev This library assumes that the tx is of the GenericTransaction format
 */
library MoreVpFinalization {
    using PosLib for PosLib.Position;

    /**
    * @notice Checks whether a transaction is "standard finalized".
    *         For MoreVP, it means the transaction should be included in a plasma block.
    */
    function isStandardFinalized(
        PlasmaFramework framework,
        bytes memory txBytes,
        PosLib.Position memory txPos,
        bytes memory inclusionProof
    )
        internal
        view
        returns (bool)
    {
        require(txPos.outputIndex == 0, "Invalid transaction position");
        GenericTransaction.Transaction memory genericTx = GenericTransaction.decode(txBytes);
        uint8 protocol = framework.protocols(genericTx.txType);
        require(protocol == Protocol.MORE_VP(), "MoreVpFinalization: not a MoreVP protocol tx");

        (bytes32 root,) = framework.blocks(txPos.blockNum);
        require(root != bytes32(""), "Failed to get the root hash of the block num");

        return Merkle.checkMembership(
            txBytes, txPos.txIndex, root, inclusionProof
        );
    }

    /**
    * @notice Checks whether a transaction is "protocol finalized"
    *         For MoreVP, since it allows in-flight tx, so only checks for the existence of the transaction
    */
    function isProtocolFinalized(
        PlasmaFramework framework,
        bytes memory txBytes
    )
        internal
        view
        returns (bool)
    {
        if (txBytes.length == 0) {
            return false;
        }

        GenericTransaction.Transaction memory genericTx = GenericTransaction.decode(txBytes);
        uint8 protocol = framework.protocols(genericTx.txType);
        require(protocol == Protocol.MORE_VP(), "MoreVpFinalization: not a MoreVP protocol tx");

        return true;
    }
}
