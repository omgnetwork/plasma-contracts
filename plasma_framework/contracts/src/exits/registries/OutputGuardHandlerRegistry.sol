pragma solidity 0.5.11;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../interfaces/IOutputGuardHandler.sol";

/**
 * @title OutputGuardHandlerRegistry
 * @notice The registry contracts of outputGuard handler
 * @dev This is designed to renounce the ownership before injecting the registry contract to the ExitGame contracts
 *      After registering all the essential condition contracts, the owner should renounce its ownership to
 *      ensure no further conditions are registered for an ExitGame contract.
 *      https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/ownership/Ownable.sol#L55
 */
contract OutputGuardHandlerRegistry is Ownable {
    // mapping of outputType to IOutputGuardHandler
    mapping(uint256 => IOutputGuardHandler) public outputGuardHandlers;

    /**
     * @notice Register the output guard handler
     * @param outputType The output type registered with the parser
     * @param handler The output guard handler contract
     */
    function registerOutputGuardHandler(uint256 outputType, IOutputGuardHandler handler)
        public
        onlyOwner
    {
        require(outputType != 0, "Registration not possible with output type 0");
        require(address(handler) != address(0), "Registration not possible with an empty address");
        require(address(outputGuardHandlers[outputType]) == address(0), "Output type already registered");

        outputGuardHandlers[outputType] = handler;
    }
}
