pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/utils/PosLib.sol";

contract UtxoPosLibWrapper {
    using PosLib for PosLib.Position;

    function build(uint256 txPos, uint16 outputIndex) public pure returns (PosLib.Position memory) {
        return PosLib.build(txPos, outputIndex);
    }

    function blockNum(uint256 _utxoPos) public pure returns (uint256) {
        return PosLib.Position(_utxoPos).blockNum();
    }

    function txIndex(uint256 _utxoPos) public pure returns (uint256) {
        return PosLib.Position(_utxoPos).txIndex();
    }

    function outputIndex(uint256 _utxoPos) public pure returns (uint16) {
        return PosLib.Position(_utxoPos).outputIndex();
    }

    function txPos(uint256 _utxoPos) public pure returns (PosLib.Position memory) {
        return PosLib.Position(_utxoPos).txPos();
    }
}
