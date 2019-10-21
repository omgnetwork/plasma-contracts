pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import {TxFinalizationModel as Model} from "../models/TxFinalizationModel.sol";

/**
 * @notice Interface for the code that checks the finalization status of a transaction
 * @dev We define two kinds of finalization: Protocol and Standard
 *      1. Protocol Finalization: A transaction is considered finalized for the protocol to spend its input transaction.
 *      2. Standard Finalization: A protocol finalized transaction has a clear position (being mined) in the Plasma block
 *      > For MVP:
 *         a. Protocol finalized: Confirm signature must be present. Since confirm signature requires the transaction to be mined in a block,
 *            it will also have a clear position. Thus, protocol finalization would be same as standard finalization for MVP protocol.
 *         b. Standard finalized: Confirm signature must be present, and the transaction is mined in a Plasma block
 *      > For MoreVp:
 *         a. Protocol finalized: Since MoreVP allows in-flight transactions, any existing transaction
 *         b. Standard finalized: The transaction is mined in a Plasma block
 *
 * @dev We've chosen to use an interface in our first deployment cycle since there will be no MVP protocol transactions. This means we can remain open to how we will handle MVP in future. For example, we can check the confirm sig by block root hash, or (block root hash, block number) pair, or even with EIP712 format. Keeping this upgradeable provides flexibility and allows us to test with our real MVP transactions in future.

 *      See: https://github.com/omisego/plasma-contracts/issues/301#issuecomment-535430135
 */
interface ITxFinalizationVerifier {
    /**
    * @notice Checks whether a transaction is "standard finalized"
    * @dev MVP: Requires that both inclusion proof and confirm signature is verified
    * @dev MoreVp: Checks inclusion proof
    */
    function isStandardFinalized(Model.Data calldata self) external view returns (bool);

    /**
    * @notice Checks whether a transaction is "protocol finalized"
    * @dev MVP: Must be standard finalized
    * @dev MoreVp: Allows in-flight tx, so only checks that the transaction exists
    */
    function isProtocolFinalized(Model.Data calldata self) external view returns (bool);
}
