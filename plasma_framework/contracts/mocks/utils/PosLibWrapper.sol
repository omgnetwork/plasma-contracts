pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/utils/PosLib.sol";

contract PosLibWrapper {
    using PosLib for PosLib.Position;

    function buildPositionFromTxPosAndOutputIndex(uint256 txPos, uint16 outputIndex)
        public
        pure
        returns (PosLib.Position memory)
    {
        return PosLib.buildPositionFromTxPosAndOutputIndex(txPos, outputIndex);
    }

    function txPos(PosLib.Position memory pos)
        public
        pure
        returns (PosLib.Position memory)
    {
        return pos.txPos();
    }

    function getTxPostionForExitPriority(PosLib.Position memory pos)
        public
        pure
        returns (uint256)
    {
        return pos.getTxPostionForExitPriority();
    }

    function encode(PosLib.Position memory pos) public pure returns (uint256) {
        return pos.encode();
    }

    function encodePackedTxPos(PosLib.Position memory pos) public pure returns (uint256) {
        return pos.encodePackedTxPos();
    }

    function decode(uint256 pos) public pure returns (PosLib.Position memory) {
        return PosLib.decode(pos);
    }
}
