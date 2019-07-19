pragma solidity ^0.5.0;

import "../../../src/framework/registries/VaultRegistry.sol";

contract VaultRegistryMock is VaultRegistry {
    uint256 public constant QUARANTINE_PERIOD = 0;
    uint256 public constant INITIAL_IMMUNE_VAULTS = 0;

    event OnlyFromVaultChecked();

    constructor () VaultRegistry(QUARANTINE_PERIOD, INITIAL_IMMUNE_VAULTS) public {
    }

    function checkOnlyFromVault() public onlyFromVault {
        emit OnlyFromVaultChecked();
    }
}
