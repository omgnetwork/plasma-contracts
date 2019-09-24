pragma solidity 0.5.11;

import "../../src/framework/Protocol.sol";

contract ProtocolWrapper {
    function isValidProtocol(uint8 protocol) public pure returns (bool) {
        return Protocol.isValidProtocol(protocol);
    }
}
