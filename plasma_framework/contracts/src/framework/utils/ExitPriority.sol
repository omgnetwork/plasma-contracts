pragma solidity ^0.5.0;

import "../../utils/TxPosLib.sol";

library ExitPriority {

    /**
     * @dev Given a utxo position and a unique ID, returns an exit priority.
     * The combination of 'exitableAt' and 'txPos' is the priority for Plasma M(ore)VP protocol.
     * 'exitableAt' only provide granularity of block, thus add 'txPos' to provide priority of transaction.
     * @param exitId Unique exit identifier.
     * @return An exit priority.
     *   Anatomy of returned value, most significant bits first
     *   42 bits - timestamp (exitable_at); we can represent dates until 2109 
     *   54 bits - blknum * 10^9 + txindex; to represent all transactions for 10 years we need only 54 bits
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
