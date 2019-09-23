pragma solidity 0.5.11;

import "../../../src/framework/utils/ExitPriority.sol";
import "../../../src/utils/TxPosLib.sol";

contract ExitPriorityWrapper {
    function computePriority(uint64 exitableAt, uint256 txPos, uint64 nonce) public pure returns (uint256) {
        return ExitPriority.computePriority(exitableAt, TxPosLib.TxPos(txPos), nonce);
    }

    function parseExitableAt(uint256 priority) public pure returns (uint64) {
        return ExitPriority.parseExitableAt(priority);
    }
}
