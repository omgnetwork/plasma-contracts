pragma solidity 0.5.11;

pragma experimental ABIEncoderV2;

import "../../src/utils/RLPReader.sol";

contract RLPMockSecurity {

    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;

    function decodeBytes32(bytes memory _data) public pure returns (bytes32) {
        return bytes32(_data.toRlpItem().toUint());
    }

    function decodeBytes20(bytes memory _data) public pure returns (bytes20) {
        return bytes20(_data.toRlpItem().toAddress());
    }

    function decodeUint(bytes memory _data) public returns (uint) {
        return _data.toRlpItem().toUint();
    }

    function decodeList(bytes memory _data) public pure returns (RLPReader.RLPItem[] memory) {
        return _data.toRlpItem().toList();
    }
}
