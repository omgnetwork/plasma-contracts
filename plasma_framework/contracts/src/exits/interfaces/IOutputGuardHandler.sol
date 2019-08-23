pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../models/OutputGuardModel.sol";

interface IOutputGuardHandler {
    /**
    * @notice Checks a given output guard data
    */
    function isValid(OutputGuardModel.Data calldata object) external view returns (bool);

    /**
    * @notice This parses the 'exit target' from the data set
    */
    function getExitTarget(OutputGuardModel.Data calldata object) external view returns (address payable);
}
