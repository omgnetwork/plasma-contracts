pragma solidity 0.5.11;

/**
 * @dev An interface to allow custom logic on processing exit for different needs.
 *      It would be used to dispatch to each custom processor when 'processExits' is called on PlasmaFramework.
 */
interface IExitProcessor {
    /**
     * @dev Custom function to process exit. Would do nothing if not able to exit (eg. successfully challenged)
     * @param exitId unique id for exit per tx type.
     * @param token The address of the contract for the token.
     */
    function processExit(uint160 exitId, address token) external;
}
