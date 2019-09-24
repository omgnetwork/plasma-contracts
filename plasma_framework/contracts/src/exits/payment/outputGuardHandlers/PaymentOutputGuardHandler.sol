pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../interfaces/IOutputGuardHandler.sol";
import "../../models/OutputGuardModel.sol";
import "../../../utils/AddressPayable.sol";

contract PaymentOutputGuardHandler is IOutputGuardHandler {
    uint256 internal outputType;

    /**
     * @dev This is designed to be re-useable for all versions of Payment output in Payment transaction.
     *      As a result, outputType of the Payment output is injected instead.
     */
    constructor(uint256 _outputType) public {
        outputType = _outputType;
    }

    function isValid(OutputGuardModel.Data memory data) public view returns (bool) {
        require(data.preimage.length == 0, "Pre-imgage of the output guard should be empty");
        require(data.outputType == outputType, "Output type mismatch");
        return true;
    }

    function getExitTarget(OutputGuardModel.Data calldata data) external view returns (address payable) {
        return AddressPayable.convert(address(uint160(data.guard)));
    }

    function getConfirmSigAddress(OutputGuardModel.Data calldata /*data*/)
        external
        view
        returns (address)
    {
        // MoreVP transaction, no need to have confirm sig.
        return address(0);
    }
}
