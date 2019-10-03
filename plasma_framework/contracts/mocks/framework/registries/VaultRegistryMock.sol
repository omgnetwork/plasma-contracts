pragma solidity 0.5.11;

import "../../../src/framework/registries/VaultRegistry.sol";

contract VaultRegistryMock is VaultRegistry {
    constructor (uint256 _minExitPeriod, uint256 _initialImmuneVaults)
        public
        VaultRegistry(_minExitPeriod, _initialImmuneVaults)
    {
    }

    function checkOnlyFromNonQuarantinedVault() public onlyFromNonQuarantinedVault view returns (bool) {
        return true;
    }
}
