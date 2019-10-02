pragma solidity 0.5.11;

import "../../src/utils/RLP.sol";

contract RLPMock {

    using RLP for bytes;
    using RLP for RLP.RLPItem;

    function decodeBytes32(bytes memory _data) public pure returns (bytes32) {
        return _data.toRLPItem().toBytes32();
    }

    function decodeBool(bytes memory _data) public pure returns (bool) {
        return _data.toRLPItem().toBool();
    }

    function decodeInt(bytes memory _data) public pure returns (int) {
        return _data.toRLPItem().toInt();
    }

    function decodeUint(bytes memory _data) public pure returns (uint) {
        return _data.toRLPItem().toUint();
    }

    function decodeArray(bytes memory _data) public pure returns (uint) {
        RLP.RLPItem[] memory items = (_data.toRLPItem().toList()[0]).toList();
        return items.length;
    }
}
