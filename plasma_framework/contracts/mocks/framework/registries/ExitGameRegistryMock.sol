pragma solidity ^0.5.0;

import "../../../src/framework/registries/ExitGameRegistry.sol";

contract ExitGameRegistryMock is ExitGameRegistry {
    event OnlyFromExitGameChecked();

    function checkOnlyFromExitGame() public onlyFromExitGame {
        emit OnlyFromExitGameChecked();
    }
}
