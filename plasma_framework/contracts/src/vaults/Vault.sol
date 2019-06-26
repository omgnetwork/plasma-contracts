pragma solidity ^0.5.0;

import "../framework/BlockController.sol";

contract Vault {
    BlockController blockController;

    modifier onlyFromExitGame() {
        require(false, "TODO: Implement and test once we have exit plasma framework contract");
        _;
    }
}
