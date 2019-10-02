pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/utils/TxPosLib.sol";
import "../../src/utils/UtxoPosLib.sol";

contract UtxoPosLibWrapper {
    using UtxoPosLib for UtxoPosLib.UtxoPos;

    function build(uint256 txPos, uint16 outputIndex) public pure returns (UtxoPosLib.UtxoPos memory) {
        return UtxoPosLib.build(TxPosLib.TxPos(txPos), outputIndex);
    }

    function blockNum(uint256 _utxoPos) public pure returns (uint256) {
        return UtxoPosLib.UtxoPos(_utxoPos).blockNum();
    }

    function txIndex(uint256 _utxoPos) public pure returns (uint256) {
        return UtxoPosLib.UtxoPos(_utxoPos).txIndex();
    }

    function outputIndex(uint256 _utxoPos) public pure returns (uint16) {
        return UtxoPosLib.UtxoPos(_utxoPos).outputIndex();
    }

    function txPos(uint256 _utxoPos) public pure returns (TxPosLib.TxPos memory) {
        return UtxoPosLib.UtxoPos(_utxoPos).txPos();
    }
}
