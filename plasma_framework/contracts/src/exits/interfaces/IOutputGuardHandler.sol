pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../models/OutputGuardModel.sol";

/**
 * @notice A interface for utils functions needed to process and get essential data from output guard field.
 * @dev This is required since there are multiple ways of using the field 'output guard'. For instance, in normal
 *      Payment the output guard field would hold the owner's address directly while for DEX deposit, it would be
 *      using the privacy deposit mechanism and become hash of output type and preimage.
 */
interface IOutputGuardHandler {
    /**
    * @notice Checks a given output guard data
    */
    function isValid(OutputGuardModel.Data calldata object) external view returns (bool);

    /**
    * @notice Gets the 'exit target' from the data set
    */
    function getExitTarget(OutputGuardModel.Data calldata object) external view returns (address payable);

    /**
    * @notice Gets the 'confirm signature address' from the data set. Returns address(0) if none.
    */
    function getConfirmSigAddress(OutputGuardModel.Data calldata object) external view returns (address);
}
