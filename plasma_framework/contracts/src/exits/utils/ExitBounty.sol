pragma solidity 0.5.11;

library ExitBounty {

    /**
     * @notice Returns the Process Exit Bounty size for standard exits
     * @dev See https://github.com/omgnetwork/plasma-contracts/issues/658 for discussion about size
     * 107000 is the approx gas usage for calling processExit()
     */
    function processStandardExitBountySize(uint256 gasPriceStartExit) internal pure returns (uint256) {
        return 107000 * gasPriceStartExit;
    }

     /**
     * @notice Returns the Process Exit Bounty size for in-flight exits
     * @dev See https://github.com/omgnetwork/plasma-contracts/issues/658 for discussion about size
     */
    function processInFlightExitBountySize(uint256 gasPricePiggyback) internal pure returns (uint256) {
        return 500000 * gasPricePiggyback;
    }

}
