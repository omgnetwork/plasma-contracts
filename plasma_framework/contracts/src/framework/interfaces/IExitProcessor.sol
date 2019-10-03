pragma solidity 0.5.11;

/**
 * @dev An interface to allow custom logic for processing exits for different needs.
 *      It is used to dispatch to each custom processor when 'processExits' is called on PlasmaFramework.
 */
interface IExitProcessor {
    /**
     * @dev function interface to process exits.
     * @param exitId unique id for exit per tx type.
     * @param token address of the token contract.
     */
    function processExit(uint160 exitId, address token) external;
}
