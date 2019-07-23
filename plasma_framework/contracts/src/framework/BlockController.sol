pragma solidity ^0.5.0;

import "./models/BlockModel.sol";
import "./registries/VaultRegistry.sol";
import "./utils/Operated.sol";

contract BlockController is Operated, VaultRegistry {
    uint256 public childBlockInterval;
    uint256 public nextChildBlock;
    uint256 public nextDepositBlock;

    mapping (uint256 => BlockModel.Block) public blocks;

    event BlockSubmitted(
        uint256 blockNumber
    );

    constructor(uint256 _interval, uint256 _minExitPeriod, uint256 _initialImmuneVaults)
        public
        VaultRegistry(_minExitPeriod, _initialImmuneVaults)
    {
        childBlockInterval = _interval;
        nextChildBlock = childBlockInterval;
        nextDepositBlock = 1;
    }

    /**
     * @notice Allows operator to submit a child chain block.
     * @dev Block number jumps 'childBlockInterval' per submission.
     * @param _blockRoot Merkle root of the block.
     */
    function submitBlock(bytes32 _blockRoot) external onlyOperator {
        uint256 submittedBlockNumber = nextChildBlock;

        blocks[submittedBlockNumber] = BlockModel.Block({
            root: _blockRoot,
            timestamp: block.timestamp
        });

        nextChildBlock += childBlockInterval;
        nextDepositBlock = 1;

        emit BlockSubmitted(submittedBlockNumber);
    }

    /**
     * @notice Allows vault contracts to submit a block for deposit.
     * @dev Block number adds 1 per submission, could have at most 'childBlockInterval' deposit blocks between two child chain blocks.
     * @param _blockRoot Merkle root of the block.
     */
    function submitDepositBlock(bytes32 _blockRoot) public onlyFromNonQuarantinedVault {
        require(nextDepositBlock < childBlockInterval, "Exceeded limit of deposits per child block interval");

        uint256 blknum = nextChildBlock - childBlockInterval + nextDepositBlock;
        blocks[blknum] = BlockModel.Block({
            root : _blockRoot,
            timestamp : block.timestamp
        });

        nextDepositBlock++;
    }
}
