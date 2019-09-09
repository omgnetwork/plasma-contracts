pragma solidity ^0.5.0;

interface IExitProcessor {
    /**
     * @dev Custom function to process exit. Would do nothing if not able to exit (eg. successfully challenged)
     * @param exitId unique id for exit per tx type.
     * @param ercContract which ercContract this exit queue is for. We use isolated queue for each erc contract to isolate external call impact.
     */
    function processExit(uint192 exitId, address ercContract) external;
}
