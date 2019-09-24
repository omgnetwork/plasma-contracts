pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";

import "../../framework/PlasmaFramework.sol";
import "../../framework/Protocol.sol";
import "../../utils/Merkle.sol";
import "../../utils/TxPosLib.sol";

/**
 * @notice Libarary that checks finalization status of a transaction
 * @dev We define two kinds of finalization: standard finalization and protocol finalization.
 *      1. Protocol Finalization: a transaction is considered finalized for the protocol to spend its input transaction.
 *      2. Standard Finalization: a protocol finalized transaction has a clear position (being mined) in the plasma block.
 *      > For MVP:
 *         a. Protocol finalized: need to have confirm signature signed. Since confirm signature requires the transaction to be mined in a block,
 *            it will have a clear position as well. Thus protocol finalization would be same as standard finalization for MVP protocol.
 *         b. Standard finalized: have confirm signature singed plus the transaction mined in a plasma block.
 *      > For MoreVp:
 *         a. Protocol finalized: as long as the transaction exists, since we allow in-flight transaction in MoreVp, it would be finalized.
 *         b. Standard finalized: the transaction is mined in a plasma block.
 */
library TxFinalization {
    using TxPosLib for TxPosLib.TxPos;

    /**
     * @param framework Plasma framework contract
     * @param protocol Either MVP or MoreVp. see 'Protocol.sol' for the representive value.
     * @param txBytes Encoded transaction in bytes format that is checking the finalization.
     * @param txPos (Optional) Tx position of the transaction.
     * @param inclusionProof (Optional) Inclusion proof of the merkle path of the transaction
     * @param confirmSig (Optional) Confirm signature of the transaction.
     * @param confirmSigAddress (Optional) Confirm signature address to check with.
     */
    struct Verifier {
        PlasmaFramework framework;
        uint8 protocol;
        bytes txBytes;
        TxPosLib.TxPos txPos;
        bytes inclusionProof;
        bytes confirmSig;
        address confirmSigAddress;
    }

    function moreVpVerifier(
        PlasmaFramework framework,
        bytes memory txBytes,
        TxPosLib.TxPos memory txPos,
        bytes memory inclusionProof
    )
        internal
        pure
        returns (Verifier memory)
    {
        // MoreVP protocol does not require check on confirm signature, thus putting empty value for related field.
        return Verifier({
            framework: framework,
            protocol: Protocol.MORE_VP(),
            txBytes: txBytes,
            txPos: txPos,
            inclusionProof: inclusionProof,
            confirmSig: bytes(""),
            confirmSigAddress: address(0)
        });
    }

    /**
    * @notice Checks a transaction is "standard finalized" or not
    * @dev MVP: need both inclusion proof and confirm signature checked.
    * @dev MoreVp: checks inclusion proof.
    */
    function isStandardFinalized(Verifier memory self) internal view returns (bool) {
        if (self.protocol == Protocol.MVP()) {
            return checkConfirmSig(self) && checkInclusionProof(self);
        } else if (self.protocol == Protocol.MORE_VP()) {
            return checkInclusionProof(self);
        } else {
            // TODO: solhint disabled for now due to bug, https://github.com/protofire/solhint/issues/157
            // solhint-disable-next-line reason-string
            revert("invalid protocol value");
        }
    }

    /**
    * @notice Checks a transaction is "protocol finalized" or not
    * @dev MVP: need to be standard finalzied.
    * @dev MoreVp: it allows in-flight tx, so only checks existence of the transaction.
    */
    function isProtocolFinalized(Verifier memory self) internal view returns (bool) {
        if (self.protocol == Protocol.MVP()) {
            return isStandardFinalized(self);
        } else if (self.protocol == Protocol.MORE_VP()) {
            return self.txBytes.length > 0;
        } else {
            // TODO: solhint disabled for now due to bug, https://github.com/protofire/solhint/issues/157
            // solhint-disable-next-line reason-string
            revert("invalid protocol value");
        }
    }

    function checkInclusionProof(Verifier memory self) private view returns (bool) {
        if (self.inclusionProof.length == 0) {
            return false;
        }

        (bytes32 root,) = self.framework.blocks(self.txPos.blockNum());
        bytes32 leafData = keccak256(self.txBytes);
        return Merkle.checkMembership(
            leafData, self.txPos.txIndex(), root, self.inclusionProof
        );
    }

    /**
    * @dev Checks confirm signature over the block root hash directly.
    * @dev All transactions within the root with same owner would be consider confirmed by this signature.
    */
    function checkConfirmSig(Verifier memory self) private view returns (bool) {
        if (self.confirmSig.length == 0) {
            return false;
        }

        (bytes32 root,) = self.framework.blocks(self.txPos.blockNum());
        return self.confirmSigAddress == ECDSA.recover(root, self.confirmSig);
    }
}
