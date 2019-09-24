pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/exits/interfaces/IOutputGuardHandler.sol";
import "../../src/exits/models/OutputGuardModel.sol";

contract ExpectedOutputGuardHandler is IOutputGuardHandler {
    bool private expectedIsValid;
    address payable private expectedExitTarget;
    address private expectedConfirmSigAddress;
    OutputGuardModel.Data private expectedData;

    /** If this function is set, all tested method would check whether the argument is the same as expected */
    function shouldVerifyArgumentEquals(OutputGuardModel.Data memory data) public {
        expectedData = data;
    }

    /** Mock the isValid() function return value */
    function mockIsValid(bool isValid) public {
        expectedIsValid = isValid;
    }

    /** Mock the getExitTarget() function return value */
    function mockGetExitTarget(address payable exitTarget) public {
        expectedExitTarget = exitTarget;
    }

    /** Mock the getConfirmSigAddress() function return value  */
    function mockGetConfirmSigAddress(address payable confirmSigAddress) public {
        expectedConfirmSigAddress = confirmSigAddress;
    }

    /** overrride */
    function isValid(OutputGuardModel.Data memory data) public view returns (bool) {
        require(isDataExpected(data), "Input args of 'isValid' function mismatch the expected data");
        return expectedIsValid;
    }

    /** overrride */
    function getExitTarget(OutputGuardModel.Data memory data) public view returns (address payable) {
        require(isDataExpected(data), "Input args of 'getExitTarget' function mismatch the expected data");
        return expectedExitTarget;
    }

    /** override */
    function getConfirmSigAddress(OutputGuardModel.Data memory data) public view returns (address) {
        require(isDataExpected(data), "Input args of 'getExitTgetConfirmSigAddressarget' function mismatch the expected data");
        return expectedConfirmSigAddress;
    }

    function isDataExpected(OutputGuardModel.Data memory data) private view returns (bool) {
        // only test this when expected data is set. So we can tune only small portion of tests need to set this up.
        if (expectedData.guard == bytes20(""))
            return true;

        return data.guard == expectedData.guard &&
            data.outputType == expectedData.outputType &&
            keccak256(data.preimage) == keccak256(expectedData.preimage);
    }
}
