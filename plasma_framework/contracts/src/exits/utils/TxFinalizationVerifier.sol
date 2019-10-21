pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../interfaces/ITxFinalizationVerifier.sol";
import "../../framework/Protocol.sol";
import "../../utils/Merkle.sol";
import "../../utils/TxPosLib.sol";

import {TxFinalizationModel as Model} from "../models/TxFinalizationModel.sol";

/**
 * @notice Contract that checks the tx finalization, currently only MoreVp functionality is implemented
 * @dev Only the MoreVP function is currently implemented. MVP functionality is reserved for future development.
 *      The new ExitGame can dependency inject a different implementation that adds the MVP functionality in future.
 */
contract TxFinalizationVerifier is ITxFinalizationVerifier {
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
            revert("MVP is not yet supported");
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
            revert("MVP is not yet supported");
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
}
