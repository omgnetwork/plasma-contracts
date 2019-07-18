pragma solidity ^0.5.0;

library ExitModel {
    struct Exit {
        uint64 exitableAt;
        address exitProcessor;
        uint192 exitId; // This is for each exit game contract to design
    }
}
