pragma solidity ^0.5.0;

import "../../../src/framework/registries/VaultRegistry.sol";

contract VaultRegistryMock is VaultRegistry {
    event OnlyFromVaultChecked();

    function checkOnlyFromVault() public onlyFromVault {
        emit OnlyFromVaultChecked();
    }
}
