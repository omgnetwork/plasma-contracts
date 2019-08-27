pragma solidity ^0.5.0;

interface IOutputGuardParser {
    /**
    * @notice Parses the 'exit target' data out from the output guard data.
    */
    function parseExitTarget(bytes calldata _outputGuardData) external view returns (address payable);
}
