pragma solidity 0.5.11;

import "../../src/framework/Protocol.sol";

contract ProtocolWrapper {
    // solhint-disable-next-line func-name-mixedcase
    function MVP() public pure returns (uint8) {
        return Protocol.MVP();
    }

    // solhint-disable-next-line func-name-mixedcase
    function MORE_VP() public pure returns (uint8) {
        return Protocol.MORE_VP();
    }

    function isValidProtocol(uint8 protocol) public pure returns (bool) {
        return Protocol.isValidProtocol(protocol);
    }
}
