pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../src/framework/PlasmaFramework.sol";
import "../../src/utils/TxPosLib.sol";
import "../../src/framework/models/BlockModel.sol";

contract SpyPlasmaFrameworkForExitGame is PlasmaFramework {
    uint256 public enqueuedCount = 0;
    mapping (uint256 => BlockModel.Block) public blocks;
    event EnqueueTriggered(
        address token,
        uint64 exitableAt,
        uint256 txPos,
        uint256 exitId,
        address exitProcessor
    );

    constructor(uint256 _minExitPeriod, uint256 _initialImmuneVaults, uint256 _initialImmuneExitGames)
        public
        PlasmaFramework(_minExitPeriod, _initialImmuneVaults, _initialImmuneExitGames) {
    }

    /** override for test */
    function enqueue(address _token, uint64 _exitableAt, TxPosLib.TxPos calldata _txPos, uint192 _exitId, IExitProcessor _exitProcessor)
        external
        returns (uint256)
    {
        enqueuedCount += 1;
        emit EnqueueTriggered(
            _token,
            _exitableAt,
            _txPos.value,
            _exitId,
            address(_exitProcessor)
        );
        return enqueuedCount;
    }

    /**
     Custom test helpers
     */

    function setBlock(uint256 _blockNum, bytes32 _root, uint256 _timestamp) external {
        blocks[_blockNum] = BlockModel.Block(_root, _timestamp);
    }
}
