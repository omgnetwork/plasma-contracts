pragma solidity ^0.4.0;

library  ExitModel {
    struct Exit {
        address exitGameContract;
        uint256 priority;
        uint256 exitId; // TODO: rethink exit model (what data is needed and how to store it)
    }
}
