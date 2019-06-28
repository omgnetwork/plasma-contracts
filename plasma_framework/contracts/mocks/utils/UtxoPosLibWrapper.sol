pragma solidity ^0.5.0;

import "../../src/utils/UtxoPosLib.sol";

contract UtxoPosLibWrapper {
    using UtxoPosLib for UtxoPosLib.UtxoPos;

    function blockNum(uint256 _utxoPos) public pure returns (uint256) {
        return UtxoPosLib.UtxoPos(_utxoPos).blockNum();
    }

    function txIndex(uint256 _utxoPos) public pure returns (uint256) {
        return UtxoPosLib.UtxoPos(_utxoPos).txIndex();
    }

    function outputIndex(uint256 _utxoPos) public pure returns (uint8) {
        return UtxoPosLib.UtxoPos(_utxoPos).outputIndex();
    }

    function txPos(uint256 _utxoPos) public pure returns (uint256) {
        return UtxoPosLib.UtxoPos(_utxoPos).txPos();
    }
}
