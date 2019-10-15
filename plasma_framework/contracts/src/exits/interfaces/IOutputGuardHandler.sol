pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../models/OutputGuardModel.sol";

/**
 * @notice An interface for utils functions, required for processing and retrieving essential data from the `output guard` field.
 * @dev This is required because there are multiple ways of using the `output guard` field. For example, in normal
 *      payments the `output guard` field holds the owner's address directly, while for DEX deposits the `output guard` field uses
 *      the privacy deposit mechanism and becomes the hash of output type and preimage.
 */
interface IOutputGuardHandler {
    /**
    * @notice Checks a given output guard data.
    */
    function isValid(OutputGuardModel.Data calldata object) external view returns (bool);

    /**
    * @notice Gets the 'exit target' from the data set.
    */
    function getExitTarget(OutputGuardModel.Data calldata object) external view returns (address payable);

    /**
    * @notice Gets the 'confirm signature address' from the data set. Returns address(0) if none.
    */
    function getConfirmSigAddress(OutputGuardModel.Data calldata object) external view returns (address);
}
