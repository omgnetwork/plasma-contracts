pragma solidity 0.5.11;

library BlockModel {
    struct Block {
        bytes32 root;
        uint256 timestamp;
    }
}
