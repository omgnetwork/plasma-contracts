pragma solidity ^0.5.0;

import "../../src/framework/utils/Quarantine.sol";

contract QuarantineRegistryMock is Quarantine {
    mapping(uint256 => address) private _contracts;

    constructor(uint256 _period, uint256 _initialImmuneCount)
    public
    Quarantine(_period, _initialImmuneCount)
    {}

    function registerContract(uint256 _contractId, address _contractAddress) public {
        _contracts[_contractId] = _contractAddress;
        Quarantine.quarantine(_contractAddress);
    }

    function test() public view notQuarantined(msg.sender) returns (bool) {
        return true;
    }
}

contract QuarantinedContractMock {
    QuarantineRegistryMock private _registry;

    constructor(address _reg) public {
        _registry = QuarantineRegistryMock(_reg);
    }

    function test() public view returns (bool) {
        return _registry.test();
    }
}
