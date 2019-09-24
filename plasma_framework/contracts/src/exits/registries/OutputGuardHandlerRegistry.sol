pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../interfaces/IOutputGuardHandler.sol";

/**
 * @title OutputGuardHandlerRegistry
 * @notice The registry contracts of outputGuard handler
 * @dev It is designed to renounce the ownership before injecting the registry contract to the ExitGame contracts.
 *      After registering all the essential condition contracts, the owner should renounce its ownership to
 *      make sure no further conditions are registered for an ExitGame contract.
 *      https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/ownership/Ownable.sol#L55
 */
contract OutputGuardHandlerRegistry is Ownable {
    // mapping of outputType to IOutputGuardHandler
    mapping(uint256 => IOutputGuardHandler) public outputGuardHandlers;

    /**
     * @notice Register the output guard handler.
     * @param outputType output type that the parser is registered with.
     * @param handler The output guard handler contract.
     */
    function registerOutputGuardHandler(uint256 outputType, IOutputGuardHandler handler)
        public
        onlyOwner
    {
        require(outputType != 0, "Should not register with output type 0");
        require(address(handler) != address(0), "Should not register an empty address");
        require(address(outputGuardHandlers[outputType]) == address(0), "The output type has already been registered");

        outputGuardHandlers[outputType] = handler;
    }
}
