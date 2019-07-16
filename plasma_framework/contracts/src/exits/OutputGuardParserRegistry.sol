pragma solidity ^0.5.0;

import "./IOutputGuardParser.sol";
import "../utils/Freezable.sol";
import "../framework/utils/Operated.sol";

contract OutputGuardParserRegistry is Operated, Freezable {
    mapping(uint256 => IOutputGuardParser) private _outputGuardParsers;

    function outputGuardParsers(uint256 _outputType) public view returns (IOutputGuardParser) {
        return _outputGuardParsers[_outputType];
    }

    /**
     * @notice Register the output parser.
     * @param _outputType output type that the parser is registered with.
     * @param _parserAddress Address of the output parser.
     */
    function registerOutputGuardParser(uint256 _outputType, address _parserAddress)
        public
        onlyOperator
        onlyNonFrozen
    {
        require(_outputType != 0, "Should not register with output type 0");
        require(_parserAddress != address(0), "Should not register an empty address");
        require(address(_outputGuardParsers[_outputType]) == address(0), "The output type has already been registered");

        _outputGuardParsers[_outputType] = IOutputGuardParser(_parserAddress);
    }
}
