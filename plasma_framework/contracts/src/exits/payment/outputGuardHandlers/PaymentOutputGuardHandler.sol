pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../interfaces/IOutputGuardHandler.sol";
import "../../models/OutputGuardModel.sol";
import "../../../utils/AddressPayable.sol";

contract PaymentOutputGuardHandler is IOutputGuardHandler {
    function isValid(OutputGuardModel.Data memory data) public view returns (bool) {
        require(data.preimage.length == 0, "Pre-image of the output guard should be empty");
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
