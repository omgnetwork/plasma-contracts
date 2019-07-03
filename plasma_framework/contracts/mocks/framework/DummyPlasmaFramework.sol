pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../src/framework/interfaces/IPlasmaFramework.sol";
import "../../src/framework/models/BlockModel.sol";

contract DummyPlasmaFramework is IPlasmaFramework {
    mapping (uint256 => BlockModel.Block) public blocks;
    mapping (bytes32 => ExitModel.Exit) public testExitQueue;

    /**
        Interface functions
     */

    function CHILD_BLOCK_INTERVAL() external view returns (uint256) {
        return 1000;
    }

    function minExitPeriod() external view returns (uint256) {
        return 60 * 60 * 24 * 7; // 7 days
    }

    function enqueue(uint192 _priority, address _token, ExitModel.Exit memory _exit) public returns (uint256) {
        bytes32 key = keccak256(abi.encodePacked(uint256(_priority), _token));
        testExitQueue[key] = _exit;
    }

    /**
     Custom test helpers
     */

    function setBlock(uint256 _blockNum, bytes32 _root, uint256 _timestamp) external {
        blocks[_blockNum] = BlockModel.Block(_root, _timestamp);
    }
}
