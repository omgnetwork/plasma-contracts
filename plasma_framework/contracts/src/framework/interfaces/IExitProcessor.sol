pragma solidity 0.5.11;

interface IExitProcessor {
    /**
     * @dev Custom function to process exit. Would do nothing if not able to exit (eg. successfully challenged)
     * @param exitId unique id for exit per tx type.
     * @param token The address of the contract for the token.
     */
    function processExit(uint192 exitId, address token) external;
}
