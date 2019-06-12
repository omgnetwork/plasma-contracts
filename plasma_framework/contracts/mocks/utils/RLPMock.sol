pragma solidity ^0.5.0;

import "../../src/utils/RLP.sol";

contract RLPMock {

    using RLP for bytes;
    using RLP for RLP.RLPItem;

    function decodeBytes(bytes memory _data) public view returns (bytes memory) {
        bytes memory expected = "bytes";
        bytes memory actual = _data.toRLPItem().toBytes();
        require(actual.length == 6);
    }

    function decodeBytes32(bytes memory _data) public view returns (bytes32) {
      return _data.toRLPItem().toBytes32();
    }

    function decodeBool(bytes memory _data) public view returns (bool) {
        return _data.toRLPItem().toBool();
    }

    function decodeInt(bytes memory _data) public view returns (int) {
        return _data.toRLPItem().toInt();
    }

    function decodeUint(bytes memory _data) public view returns (uint) {
        return _data.toRLPItem().toUint();
    }

    function decodeArray(bytes memory _data) public view returns (uint) {
        RLP.RLPItem[] memory items = _data.toRLPItem().toList();
        return items.length;
    }
}
