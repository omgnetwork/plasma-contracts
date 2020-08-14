pragma solidity 0.5.11;

import "../../src/exits/utils/ExitBounty.sol";

contract ExitBountyWrapper {

    function processStandardExitBountySize(uint256 gasPriceStartExit) public view returns (uint256) {
        return ExitBounty.processStandardExitBountySize(gasPriceStartExit);
    }

    function processInFlightExitBountySize(uint256 gasPricePiggyback) public view returns (uint256) {
        return ExitBounty.processInFlightExitBountySize(gasPricePiggyback);
    }

}
