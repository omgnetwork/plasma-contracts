pragma solidity 0.5.11;

import "../../src/exits/utils/ExitBounty.sol";

contract ExitBountyMock {
    using ExitBounty for ExitBounty.Params;

    ExitBounty.Params public exitBounty;

    constructor (uint128 initialExitBountySize, uint16 lowerBoundDivisor, uint16 upperBoundMultiplier) public {
        exitBounty = ExitBounty.buildParams(initialExitBountySize, lowerBoundDivisor, upperBoundMultiplier);
    }

    function exitBountySize() public view returns (uint128) {
        return exitBounty.exitBountySize();
    }
    
    function updateExitBountySize(uint128 newExitBountySize) public {
        exitBounty.updateExitBountySize(newExitBountySize);
    }
}
