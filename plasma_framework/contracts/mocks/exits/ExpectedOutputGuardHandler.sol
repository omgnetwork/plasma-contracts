pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../src/exits/interfaces/IOutputGuardHandler.sol";
import "../../src/exits/models/OutputGuardModel.sol";

contract ExpectedOutputGuardHandler is IOutputGuardHandler {
    bool expectedIsValid;
    address payable expectedExitTarget;

    constructor(bool isValid, address payable exitTarget) public {
        expectedIsValid = isValid;
        expectedExitTarget = exitTarget;
    }

    function isValid(OutputGuardModel.Data calldata /*guardInstance*/) external view returns (bool) {
        return expectedIsValid;
    }

    function getExitTarget(OutputGuardModel.Data calldata /*guardInstance*/) external view returns (address payable) {
        return expectedExitTarget;
    }
}
