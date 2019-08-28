pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../src/exits/interfaces/IOutputGuardHandler.sol";
import "../../src/exits/models/OutputGuardModel.sol";

contract ExpectedOutputGuardHandler is IOutputGuardHandler {
    bool expectedIsValid;
    address payable expectedExitTarget;
    OutputGuardModel.Data expectedData;

    /** Set the expected return value in constructor */
    constructor(bool isValid, address payable exitTarget) public {
        expectedIsValid = isValid;
        expectedExitTarget = exitTarget;
    }

    /** If this function is set, all tested method would check whether the argument is the same as expected */
    function shouldVerifyArgumentEquals(OutputGuardModel.Data memory data) public {
        expectedData = data;
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

    function isDataExpected(OutputGuardModel.Data memory data) private view returns (bool) {
        // only test this when expected data is set. So we can tune only small portion of tests need to set this up.
        if (expectedData.guard == bytes32(''))
            return true;

        return data.guard == expectedData.guard &&
            data.outputType == expectedData.outputType &&
            keccak256(data.preimage) == keccak256(expectedData.preimage);
    }
}
