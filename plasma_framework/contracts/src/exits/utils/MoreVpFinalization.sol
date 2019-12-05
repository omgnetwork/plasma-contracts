pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../framework/PlasmaFramework.sol";
import "../../framework/Protocol.sol";
import "../../utils/Merkle.sol";
import "../../utils/TxPosLib.sol";
import "../../transactions/WireTransaction.sol";

/**
 * @notice Library to check finalization for MoreVP protocol
 * @dev This library assumes that the tx is of the WireTransaction format
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
        uint256 txType = WireTransaction.getTransactionType(txBytes);
        uint8 protocol = framework.protocols(txType);
        require(protocol == Protocol.MORE_VP(), "MoreVpFinalization: not a MoreVP protocol tx");
        
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

        uint256 txType = WireTransaction.getTransactionType(txBytes);
        uint8 protocol = framework.protocols(txType);
        require(protocol == Protocol.MORE_VP(), "MoreVpFinalization: not a MoreVP protocol tx");

        return true;
    }
}
