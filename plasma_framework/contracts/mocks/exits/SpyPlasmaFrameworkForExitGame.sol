pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../src/framework/PlasmaFramework.sol";
import "../../src/framework/models/BlockModel.sol";

contract SpyPlasmaFrameworkForExitGame is PlasmaFramework {
    mapping (uint256 => BlockModel.Block) public blocks;
    mapping (bytes32 => ExitModel.Exit) public testExitQueue;

    constructor(uint256 _minExitPeriod, uint256 _initialImmuneVaults, uint256 _initialImmuneExitGames)
        public
        PlasmaFramework(_minExitPeriod, _initialImmuneVaults, _initialImmuneExitGames) {
    }

    /** override for test */
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
