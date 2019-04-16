pragma solidity ^0.5.0;

library ExitModel {
    struct Exit {
        address exitGameContract;
        uint256 priority;
        uint256 exitId; // This is for each exit game contract to design
    }
}