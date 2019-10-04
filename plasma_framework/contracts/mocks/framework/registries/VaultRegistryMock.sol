pragma solidity 0.5.11;

import "../../../src/framework/registries/VaultRegistry.sol";

contract VaultRegistryMock is VaultRegistry {
    constructor (uint256 _minExitPeriod, uint256 _initialImmuneVaults, address _maintainer)
        public
        VaultRegistry(_minExitPeriod, _initialImmuneVaults, _maintainer)
    {
    }

    function checkOnlyFromNonQuarantinedVault() public onlyFromNonQuarantinedVault view returns (bool) {
        return true;
    }
}
