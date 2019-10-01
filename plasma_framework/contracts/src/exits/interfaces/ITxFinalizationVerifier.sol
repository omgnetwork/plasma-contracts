pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import {TxFinalizationModel as Model} from "../models/TxFinalizationModel.sol";

/**
 * @notice Interface for the code that checks finalization status of a transaction
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
 *
 * @dev Reason of using an interface for now is that in our first cycle of deployment there would not be any MVP protocol transactions. As a result, we would like
 *      to not fix how in defail we want to handle MVP yet. For instance, we can check the confirm sig by block root hash, or (block root hash, block number) pair or
 *      even with EIP712 format. Keeping this upgradeable in the future left us more flexible situation and enable us to test with our real MVP transaction in the future.
 *      see: https://github.com/omisego/plasma-contracts/issues/301#issuecomment-535430135
 */
interface ITxFinalizationVerifier {
    /**
    * @notice Checks a transaction is "standard finalized" or not
    * @dev MVP: need both inclusion proof and confirm signature checked.
    * @dev MoreVp: checks inclusion proof.
    */
    function isStandardFinalized(Model.Data calldata self) external view returns (bool);

    /**
    * @notice Checks a transaction is "protocol finalized" or not
    * @dev MVP: need to be standard finalzied.
    * @dev MoreVp: it allows in-flight tx, so only checks existence of the transaction.
    */
    function isProtocolFinalized(Model.Data calldata self) external view returns (bool);
}
