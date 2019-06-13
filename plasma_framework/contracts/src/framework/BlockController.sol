pragma solidity ^0.5.0;

import "./models/BlockModel.sol";
import "./registries/VaultRegistry.sol";
import "./utils/Operated.sol";

contract BlockController is Operated, VaultRegistry {
    uint256 private _childBlockInterval;
    uint256 private _nextChildBlock;
    uint256 private _nextDepositBlock;

    mapping (uint256 => BlockModel.Block) private _blocks;

    event BlockSubmitted(
        uint256 blockNumber
    );

    constructor(uint256 _interval) public {
        _childBlockInterval = _interval;
        _nextChildBlock = _childBlockInterval;
        _nextDepositBlock = 1;
    }

    function blocks(uint256 _blockNumber) public view returns (bytes32 root, uint256 timestamp) {
        BlockModel.Block memory blockData = _blocks[_blockNumber];
        return (blockData.root, blockData.timestamp);
    }

    function childBlockInterval() public view returns (uint256) {
        return _childBlockInterval;
    }

    function nextChildBlock() public view returns (uint256) {
        return _nextChildBlock;
    }

    function nextDepositBlock() public view returns (uint256) {
        return _nextDepositBlock;
    }

    /**
     * @notice Allows operator to submit a child chain block.
     * @dev Block number jumps 'childBlockInterval' per submission.
     * @param _blockRoot Merkle root of the block.
     */
    function submitBlock(bytes32 _blockRoot) public onlyOperator {
        uint256 submittedBlockNumber = _nextChildBlock;

        _blocks[submittedBlockNumber] = BlockModel.Block({
            root: _blockRoot,
            timestamp: block.timestamp
        });

        _nextChildBlock += _childBlockInterval;
        _nextDepositBlock = 1;

        emit BlockSubmitted(submittedBlockNumber);
    }

    /**
     * @notice Allows vault contracts to submit a block for deposit.
     * @dev Block number adds 1 per submission, could have at most 'childBlockInterval' deposit blocks between two child chain blocks.
     * @param _blockRoot Merkle root of the block.
     */
    function submitDepositBlock(bytes32 _blockRoot) public onlyFromVault {
        require(_nextDepositBlock < _childBlockInterval, "Exceed limit of deposits per child block interval");

        uint256 blknum = _nextChildBlock - _childBlockInterval + _nextDepositBlock;
        _blocks[blknum] = BlockModel.Block({
            root : _blockRoot,
            timestamp : block.timestamp
        });

        _nextDepositBlock++;
    }
}
