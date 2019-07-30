pragma solidity ^0.5.0;

import "../../../src/framework/utils/ExitPriority.sol";

contract ExitPriorityWrapper {
    function computePriority(uint64 exitableAt, uint64 nonce) public pure returns (uint256) {
        return ExitPriority.computePriority(exitableAt, nonce);
    }

    function parseExitableAt(uint256 priority) public pure returns (uint64) {
        return ExitPriority.parseExitableAt(priority);
    }
}
