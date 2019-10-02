pragma solidity 0.5.11;

import "../../../src/framework/registries/ExitGameRegistry.sol";

contract ExitGameRegistryMock is ExitGameRegistry {
    constructor (uint256 _minExitPeriod, uint256 _initialImmuneExitGames)
        public
        ExitGameRegistry(_minExitPeriod, _initialImmuneExitGames)
    {
    }

    function checkOnlyFromNonQuarantinedExitGame() public onlyFromNonQuarantinedExitGame view returns (bool) {
        return true;
    }
}
