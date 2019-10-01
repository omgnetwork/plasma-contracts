pragma solidity ^0.5.0;

import "../../utils/TxPosLib.sol";

library ExitPriority {

    /**
     * @dev Given a utxo position and a unique ID, returns an exit priority.
     * The combination of 'exitableAt' and 'txPos' is the priority for Plasma M(ore)VP protocol.
     * 'exitableAt' only provide granularity of block, thus add 'txPos' to provide priority of transaction.
     * @notice Full explanation on fields' lengths can be found here: https://github.com/omisego/plasma-contracts/pull/303#discussion_r328850572
     * @param exitId Unique exit identifier.
     * @return An exit priority.
     *   Anatomy of returned value, most significant bits first
     *   42 bits  - timestamp in seconds (exitable_at); we can represent dates until year 141431
     *   54 bits  - blknum * CHILD_BLOCK_INTERVAL * 10^5 + txindex; 54 bits represent all transactions for 85 years. We are assuming CHILD_BLOCK_INTERVAL = 1000.
     *   160 bits - exit id
     */
    function computePriority(uint64 exitableAt, TxPosLib.TxPos memory txPos, uint160 exitId)
        internal
        pure
        returns (uint256)
    {
        return (uint256(exitableAt) << 214) | (txPos.value << 160) | uint256(exitId);
    }

    function parseExitableAt(uint256 priority) internal pure returns (uint64) {
        return uint64(priority >> 214);
    }

    function parseExitId(uint256 priority) internal pure returns (uint160) {
        // Exit ID uses only 160 least significant bits
        return uint160(priority);
    }
}
