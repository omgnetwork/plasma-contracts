pragma solidity 0.5.11;

import "../../utils/PosLib.sol";

library ExitPriority {

    using PosLib for PosLib.Position;

    uint8 constant internal SIZEOF_TIMESTAMP = 32;
    uint8 constant internal SIZEOF_EXITID = 168;

    /**
     * @dev Returns an exit priority for a given UTXO position and a unique ID.
     * The priority for Plasma M(ore)VP protocol is a combination of 'exitableAt' and 'txPos'.
     * Since 'exitableAt' only provides granularity of block, adding 'txPos' gives higher priority to transactions added earlier in the same block.
     * @notice Detailed explanation on field lengths can be found at https://github.com/omisego/plasma-contracts/pull/303#discussion_r328850572
     * @param exitId Unique exit identifier
     * @return An exit priority
     *   Anatomy of returned value, most significant bits first
     *   32 bits  - The exitable_at timestamp (in seconds); can represent dates until the year 2106
     *   54 bits  - The transaction position. Be aware that child chain block number jumps with the interval of CHILD_BLOCK_INTERVAL (usually 1000).
                    blocknum * (BLOCK_OFFSET / TX_OFFSET) + txindex; 54 bits can represent all transactions for 85 years.
     *   168 bits - The exit id
     */
    function computePriority(uint64 exitableAt, PosLib.Position memory txPos, uint168 exitId)
        internal
        pure
        returns (uint256)
    {
        return (uint256(exitableAt) << (256 - SIZEOF_TIMESTAMP)) | (txPos.getTxPositionForExitPriority() << SIZEOF_EXITID) | uint256(exitId);
    }

    function parseExitableAt(uint256 priority) internal pure returns (uint64) {
        return uint64(priority >> (256 - SIZEOF_TIMESTAMP));
    }

    function parseExitId(uint256 priority) internal pure returns (uint168) {
        // Exit ID uses only 168 least significant bits
        return uint168(priority);
    }
}
