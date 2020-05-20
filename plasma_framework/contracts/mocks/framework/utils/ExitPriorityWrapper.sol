pragma solidity 0.5.11;

import "../../../src/framework/utils/ExitPriority.sol";
import "../../../src/utils/PosLib.sol";

contract ExitPriorityWrapper {
    function computePriority(uint64 exitableAt, uint256 txPos, uint168 exitId) public pure returns (uint256) {
        return ExitPriority.computePriority(exitableAt, PosLib.decode(txPos), exitId);
    }

    function parseExitableAt(uint256 priority) public pure returns (uint64) {
        return ExitPriority.parseExitableAt(priority);
    }

    function parseExitId(uint256 priority) public pure returns (uint168) {
        return ExitPriority.parseExitId(priority);
    }
}
