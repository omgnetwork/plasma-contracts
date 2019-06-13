pragma solidity ^0.5.0;

import "../../../src/framework/registries/VaultRegistry.sol";

contract VaultRegistryMock is VaultRegistry {
    bool public vaultCheckPass;

    constructor() public {
        vaultCheckPass = false;
    }

    function checkOnlyFromVault() public onlyFromVault {
        vaultCheckPass = true;
    }
}
