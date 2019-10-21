pragma solidity 0.5.11;

pragma experimental ABIEncoderV2;

import "../../src/utils/RLPReader.sol";

contract RLPMock {

    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;

    function decodeBytes32(bytes memory _data) public pure returns (bytes32) {
        return bytes32(_data.toRlpItem().toUint());
    }

    function decodeBytes20(bytes memory _data) public pure returns (bytes20) {
        return bytes20(_data.toRlpItem().toAddress());
    }

    function decodeInt(bytes memory _data) public pure returns (int) {
        return int(_data.toRlpItem().toUint());
    }

    function decodeUint(bytes memory _data) public pure returns (uint) {
        return _data.toRlpItem().toUint();
    }

    function decodeList(bytes memory _data) public pure returns (bytes[] memory) {
        RLPReader.RLPItem[] memory items = _data.toRlpItem().toList();

        bytes[] memory result =  new bytes[](items.length);
        for (uint i = 0; i < items.length; i++) {
            result[i] = items[i].toRlpBytes();
        }
        return result;
    }

    function decodeString(bytes memory _data) public pure returns (string memory) {
        return string(_data.toRlpItem().toBytes());
    }

    function decodeBytes(bytes memory _data) public pure returns (bytes memory) {
        return _data.toRlpItem().toBytes();
    }
}
