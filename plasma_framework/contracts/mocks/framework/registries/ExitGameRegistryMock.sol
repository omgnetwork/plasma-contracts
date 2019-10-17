pragma solidity 0.5.11;

import "../../../src/framework/registries/ExitGameRegistry.sol";

contract ExitGameRegistryMock is ExitGameRegistry {
    address private maintainer;

    constructor (uint256 _minExitPeriod, uint256 _initialImmuneExitGames)
        public
        ExitGameRegistry(_minExitPeriod, _initialImmuneExitGames)
    {
    }

    /** override to make it non-abstract contract */
    function getMaintainer() public view returns (address) {
        return maintainer;
    }

    /** test helper function */
    function setMaintainer(address maintainerToSet) public {
        maintainer = maintainerToSet;
    }

    function checkOnlyFromNonQuarantinedExitGame() public onlyFromNonQuarantinedExitGame view returns (bool) {
        return true;
    }
}
