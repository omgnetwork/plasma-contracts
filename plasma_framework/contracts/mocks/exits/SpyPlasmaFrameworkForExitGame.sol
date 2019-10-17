pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/framework/PlasmaFramework.sol";
import "../../src/utils/TxPosLib.sol";
import "../../src/framework/models/BlockModel.sol";

contract SpyPlasmaFrameworkForExitGame is PlasmaFramework {
    uint256 public enqueuedCount = 0;
    mapping (uint256 => BlockModel.Block) public blocks;

    event EnqueueTriggered(
        uint256 vaultId,
        address token,
        uint64 exitableAt,
        uint256 txPos,
        uint256 exitId,
        address exitProcessor
    );

    /** This spy contract set the authority and maintainer both to the caller */
    constructor(uint256 _minExitPeriod, uint256 _initialImmuneVaults, uint256 _initialImmuneExitGames)
        public
        PlasmaFramework(_minExitPeriod, _initialImmuneVaults, _initialImmuneExitGames, msg.sender, msg.sender)
    {
    }

    /** override for test */
    function enqueue(
        uint256 _vaultId,
        address _token,
        uint64 _exitableAt,
        TxPosLib.TxPos calldata _txPos,
        uint160 _exitId,
        IExitProcessor _exitProcessor
    )
        external
        returns (uint256)
    {
        enqueuedCount += 1;
        emit EnqueueTriggered(
            _vaultId,
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

    function setOutputSpent(bytes32 _outputId) external {
        isOutputSpent[_outputId] = true;
    }
}
