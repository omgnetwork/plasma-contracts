pragma solidity 0.5.11;

import "../../src/framework/utils/Quarantine.sol";

contract QuarantineMock {
    using Quarantine for Quarantine.Data;
    Quarantine.Data internal _quarantine;

    constructor(uint256 _period, uint256 _initialImmuneCount)
        public
    {
        _quarantine.quarantinePeriod = _period;
        _quarantine.immunitiesRemaining = _initialImmuneCount;
    }

    function quarantineContract(address _contractAddress) public {
        _quarantine.quarantine(_contractAddress);
    }

    function isQuarantined(address _contractAddress) public view returns (bool) {
        return _quarantine.isQuarantined(_contractAddress);
    }
}
