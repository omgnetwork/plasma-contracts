pragma solidity 0.5.11;

import "../../utils/TxPosLib.sol";

library ExitPriority {
    /**
     * @dev formula of priority is as followed: (exitableAt || txPos || nonce).
     * The first 64 bit for exitableAt, following 128 bits of txPos and then 64 bits of nonce.
     * The combination of 'exitableAt' and 'txPos' is the priority for Plasma M(ore)VP protocol.
     * 'exitableAt' only provide granularity of block, thus add 'txPos' to provide priority of transaction.
     */
    function computePriority(uint64 exitableAt, TxPosLib.TxPos memory txPos, uint64 nonce)
        internal
        pure
        returns (uint256)
    {
        return ((uint256(exitableAt) << 192) | (uint128(txPos.value) << 64) | nonce);
    }

    function parseExitableAt(uint256 priority) internal pure returns (uint64) {
        return uint64(priority >> 192);
    }
}
