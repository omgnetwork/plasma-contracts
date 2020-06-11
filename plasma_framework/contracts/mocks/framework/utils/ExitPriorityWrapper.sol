pragma solidity 0.5.11;

import "../../../src/framework/utils/ExitPriority.sol";
import "../../../src/utils/PosLib.sol";

contract ExitPriorityWrapper {
    uint256 constant private SIZEOF_TIMESTAMP = 32;
    uint256 constant private SIZEOF_EXITID = 168;

    function computePriority(uint32 exitableAt, uint256 txPos, uint168 exitId) public pure returns (uint256) {
        return ExitPriority.computePriority(exitableAt, PosLib.decode(txPos), exitId);
    }

    function parseExitableAt(uint256 priority) public pure returns (uint32) {
        return ExitPriority.parseExitableAt(priority);
    }

    function parseExitId(uint256 priority) public pure returns (uint168) {
        return ExitPriority.parseExitId(priority);
    }

    function parseTxPos(uint256 priority) public pure returns (uint256) {
        uint256 pos = ((priority << SIZEOF_TIMESTAMP) >> SIZEOF_EXITID + SIZEOF_TIMESTAMP);
        return pos * 10000;
    }
}
