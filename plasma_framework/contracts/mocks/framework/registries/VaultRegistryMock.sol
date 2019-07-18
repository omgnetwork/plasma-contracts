pragma solidity ^0.5.0;

import "../../../src/framework/registries/VaultRegistry.sol";

contract VaultRegistryMock is VaultRegistry {
    uint256 public constant MIN_EXIT_PERIOD = 0;
    uint256 public constant INITIAL_IMMUNE_VAULTS = 2;

    event OnlyFromVaultChecked();

    constructor () VaultRegistry(MIN_EXIT_PERIOD, INITIAL_IMMUNE_VAULTS) public {
    }

    function checkOnlyFromVault() public onlyFromVault {
        emit OnlyFromVaultChecked();
    }
}
