pragma solidity ^0.4.0;

import "./Operated.sol";


contract PlasmaBlockController is Operated {

    /*
     * Constants
     */
    uint256 constant public CHILD_BLOCK_INTERVAL = 1000;


    /*
     * Storage
     */
    struct Block {
        bytes32 root;
        uint256 timestamp;
    }

    mapping (uint256 => Block) public blocks;
    uint256 public nextChildBlock;
    uint256 public nextDepositBlock; // TODO: this should go to Wallet, but Wallet has to derive from BlockController

    /*
     * Events
     */

    event BlockSubmitted(
        uint256 blockNumber
    );

    /*
     * API
     */

    function submitBlock(bytes32 _blockRoot)
        public
        onlyOperator
    {
        uint256 submittedBlockNumber = nextChildBlock;
        // Create the block.
        blocks[submittedBlockNumber] = Block({
            root: _blockRoot,
            timestamp: block.timestamp
        });

        // Update the next child and deposit blocks.
        nextChildBlock += CHILD_BLOCK_INTERVAL;
        nextDepositBlock = 1;

        emit BlockSubmitted(submittedBlockNumber);
    }


}