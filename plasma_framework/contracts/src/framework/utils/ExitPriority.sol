pragma solidity 0.5.11;

import "../../utils/PosLib.sol";

library ExitPriority {

    using PosLib for PosLib.Position;

    /**
     * @dev Returns an exit priority for a given UTXO position and a unique ID.
     * The priority for Plasma M(ore)VP protocol is a combination of 'exitableAt' and 'txPos'.
     * Since 'exitableAt' only provides granularity of block, add 'txPos' to provide priority for a transaction.
     * @notice Detailed explanation on field lengths can be found at https://github.com/omisego/plasma-contracts/pull/303#discussion_r328850572
     * @param exitId Unique exit identifier
     * @return An exit priority
     *   Anatomy of returned value, most significant bits first
     *   42 bits  - timestamp in seconds (exitable_at); we can represent dates until year 141431
     *   54 bits  - blocknum * 10^5 + txindex; 54 bits represent all transactions for 85 years. Be aware that child chain block number jumps with the interval of CHILD_BLOCK_INTERVAL, which would be 1000 in production.
     *   160 bits - exit id
     */
    function computePriority(uint64 exitableAt, PosLib.Position memory txPos, uint160 exitId)
        internal
        pure
        returns (uint256)
    {
        return (uint256(exitableAt) << 214) | (txPos.getTxPositionForExitPriority() << 160) | uint256(exitId);
    }

    function parseExitableAt(uint256 priority) internal pure returns (uint64) {
        return uint64(priority >> 214);
    }

    function parseExitId(uint256 priority) internal pure returns (uint160) {
        // Exit ID uses only 160 least significant bits
        return uint160(priority);
    }
}
