pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../interfaces/IOutputGuardHandler.sol";
import "../../models/OutputGuardModel.sol";
import "../../../utils/AddressPayable.sol";

contract PaymentOutputGuardHandler is IOutputGuardHandler {
    uint256 outputType;

    constructor(uint256 _outputType) public {
        outputType = _outputType;
    }

    /**
    * @notice Returns whether the whole output guard data combination is a valid one
    */
    function isValid(OutputGuardModel.Data calldata data) external view returns (bool) {
        require(data.preimage.length == 0, "Pre-imgage of the output guard should be empty");
        require(data.outputType == outputType, "Output type mismatch");
        return true;
    }

    /**
    * @notice Parses the 'exit target' from the output guard data set
    */
    function getExitTarget(OutputGuardModel.Data calldata data) external view returns (address payable) {
        return AddressPayable.convert(address(uint256(data.guard)));
    }
}
