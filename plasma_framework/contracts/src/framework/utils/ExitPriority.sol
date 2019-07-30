pragma solidity ^0.5.0;

library ExitPriority {
    function computePriority(uint64 exitableAt, uint64 nonce)
        internal
        pure
        returns (uint256)
    {
        return (uint256(exitableAt) << 64 | nonce);
    }

    function parseExitableAt(uint256 priority) internal pure returns (uint64) {
        return uint64(priority >> 64);
    }
}
