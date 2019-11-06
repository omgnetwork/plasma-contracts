pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";

import "../../src/exits/interfaces/ITxFinalizationVerifier.sol";
import "../../src/framework/Protocol.sol";
import "../../src/utils/Merkle.sol";
import "../../src/utils/TxPosLib.sol";

import {TxFinalizationModel as Model} from "../../src/exits/models/TxFinalizationModel.sol";

/**
 * @notice Sample tx verifier that supports MVP and shows that we can upgrade the verifier for new exit games
 */
contract SampleTxVerifierSupportsMVP is ITxFinalizationVerifier {
    using TxPosLib for TxPosLib.TxPos;

    /**
    * @notice Checks whether a transaction is "standard finalized"
    * @dev MVP: requires that both inclusion proof and confirm signature is checked
    * @dev MoreVp: checks inclusion proof only
    */
    function isStandardFinalized(Model.Data memory data) public view returns (bool) {
        if (data.protocol == Protocol.MORE_VP()) {
            return checkInclusionProof(data);
        } else if (data.protocol == Protocol.MVP()) {
            return checkInclusionProof(data) && checkConfirmSig(data);
        } else {
            revert("Invalid protocol value");
        }
    }

    /**
    * @notice Checks whether a transaction is "protocol finalized"
    * @dev MVP: must be standard finalized
    * @dev MoreVp: allows in-flight tx, so only checks for the existence of the transaction
    */
    function isProtocolFinalized(Model.Data memory data) public view returns (bool) {
        if (data.protocol == Protocol.MORE_VP()) {
            return data.txBytes.length > 0;
        } else if (data.protocol == Protocol.MVP()) {
            return checkConfirmSig(data);
        } else {
            revert("Invalid protocol value");
        }
    }

    function checkInclusionProof(Model.Data memory data) private view returns (bool) {
        if (data.inclusionProof.length == 0) {
            return false;
        }

        (bytes32 root,) = data.framework.blocks(data.txPos.blockNum());
        bytes32 leafData = keccak256(data.txBytes);
        return Merkle.checkMembership(
            leafData, data.txPos.txIndex(), root, data.inclusionProof
        );
    }

    /**		
     * @dev Checks confirm signature over the block root hash directly.		
     * @dev All transactions within the root with same owner would be consider confirmed by this signature.		
     */		
    function checkConfirmSig(Model.Data memory data) private view returns (bool) {		
        if (data.confirmSig.length == 0) {		
            return false;		
        }		

        (bytes32 root,) = data.framework.blocks(data.txPos.blockNum());		
        return data.confirmSigAddress == ECDSA.recover(root, data.confirmSig);		
    }
}
