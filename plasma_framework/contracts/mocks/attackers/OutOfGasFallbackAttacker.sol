pragma solidity 0.5.11;

contract OutOfGasFallbackAttacker {
    function () external payable {
        while (true) {}
    }
}
