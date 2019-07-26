pragma solidity ^0.5.0;

import "../../../src/framework/registries/VaultRegistry.sol";

contract VaultRegistryMock is VaultRegistry {
    constructor (uint256 _minExitPeriod, uint256 _initialImmuneVaults)
        VaultRegistry(_minExitPeriod, _initialImmuneVaults) public {
    }

    function checkOnlyFromNonQuarantinedVault() public onlyFromNonQuarantinedVault view returns (bool) {
        return true;
    }
}
