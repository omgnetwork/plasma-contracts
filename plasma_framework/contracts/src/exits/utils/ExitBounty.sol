pragma solidity 0.5.11;

library ExitBounty {

    /**
     * @notice Returns the Process Exit Bounty size for standard exits
     */
    function processStandardExitBountySize() internal view returns (uint256) {
        return 107000 * tx.gasprice;
    }

}
