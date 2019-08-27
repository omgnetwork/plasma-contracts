pragma solidity ^0.5.0;

import "../../src/exits/interfaces/IOutputGuardParser.sol";

contract DummyOutputGuardParser is IOutputGuardParser {
    address payable resultAddress;

    constructor(address payable _resultAddress) public {
        resultAddress = _resultAddress;
    }

    function parseExitTarget(bytes calldata)
        external
        view
        returns (address payable)
    {
        return resultAddress;
    }
}
