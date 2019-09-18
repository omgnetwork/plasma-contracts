pragma solidity ^0.5.0;

contract OnlyFromAddress {

    modifier onlyFrom(address caller) {
        require(msg.sender == caller, "Not being called by expected caller");
        _;
    }
}
