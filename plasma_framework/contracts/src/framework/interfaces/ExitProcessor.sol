pragma solidity ^0.5.0;

interface ExitProcessor {
    /**
     * @dev Custom function to process exit. Would do nothing if not able to exit (eg. successfully challenged)
     * @param _exitId unique id for exit per tx type.
     */
    function processExit(uint256 _exitId) external;
}
