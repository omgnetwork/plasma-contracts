pragma solidity ^0.5.0;

import "../../../src/framework/registries/ExitGameRegistry.sol";

contract ExitGameRegistryMock is ExitGameRegistry {
    bool public exitGameCheckPass;

    constructor() public {
        exitGameCheckPass = false;
    }

    function checkOnlyFromExitGame() public onlyFromExitGame {
        exitGameCheckPass = true;
    }
}
