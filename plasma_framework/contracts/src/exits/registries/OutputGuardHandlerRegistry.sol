pragma solidity 0.5.11;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../../framework/utils/Operated.sol";
import "../interfaces/IOutputGuardHandler.sol";

contract OutputGuardHandlerRegistry is Operated {
    mapping(uint256 => IOutputGuardHandler) public outputGuardHandlers;

    /**
     * @notice Register the output guard handler.
     * @param outputType output type that the parser is registered with.
     * @param handler The output guard handler contract.
     */
    function registerOutputGuardHandler(uint256 outputType, IOutputGuardHandler handler)
        public
        onlyOperator
    {
        require(outputType != 0, "Should not register with output type 0");
        require(address(handler) != address(0), "Should not register an empty address");
        require(address(outputGuardHandlers[outputType]) == address(0), "The output type has already been registered");

        outputGuardHandlers[outputType] = handler;
    }
}
