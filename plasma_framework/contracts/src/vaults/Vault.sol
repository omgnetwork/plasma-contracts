pragma solidity ^0.5.0;

import "../framework/BlockController.sol";

contract Vault {
    BlockController blockController;

    modifier onlyFromExitProcessor() {
        require(false, "TODO: Implement and test once we have exit processors");
        _;
    }
}
