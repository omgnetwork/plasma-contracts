pragma solidity 0.5.11;

library BlockModel {
    /**
     * @notice Block data that would be stored on the contract.
     * @param root The merkle root block hash of the plasma blocks.
     * @param timestamp the timestamp in second when the block is saved.
     */
    struct Block {
        bytes32 root;
        uint256 timestamp;
    }
}
