pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../src/framework/PlasmaFramework.sol";
import "../../src/framework/models/BlockModel.sol";

contract SpyPlasmaFrameworkForExitGame is PlasmaFramework {
    mapping (uint256 => BlockModel.Block) public blocks;
    event EnqueueTriggered(
        address token,
        uint64 exitableAt,
        address exitProcessor,
        uint256 exitId
    );

    constructor(uint256 _minExitPeriod, uint256 _initialImmuneVaults, uint256 _initialImmuneExitGames)
        public
        PlasmaFramework(_minExitPeriod, _initialImmuneVaults, _initialImmuneExitGames) {
    }

    function enqueue(address _token, ExitModel.Exit memory _exit) public returns (uint256) {
        emit EnqueueTriggered(
            _token,
            _exit.exitableAt,
            _exit.exitProcessor,
            _exit.exitId
        );
        return 0;
    }

    /**
     Custom test helpers
     */

    function setBlock(uint256 _blockNum, bytes32 _root, uint256 _timestamp) external {
        blocks[_blockNum] = BlockModel.Block(_root, _timestamp);
    }
}
