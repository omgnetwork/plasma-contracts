pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/utils/PosLib.sol";

contract PosLibWrapper {
    using PosLib for PosLib.Position;

    function toStrictTxPos(PosLib.Position memory pos)
        public
        pure
        returns (PosLib.Position memory)
    {
        return pos.toStrictTxPos();
    }

    function getTxPositionForExitPriority(PosLib.Position memory pos)
        public
        pure
        returns (uint256)
    {
        return pos.getTxPositionForExitPriority();
    }

    function encode(PosLib.Position memory pos) public pure returns (uint256) {
        return pos.encode();
    }

    function decode(uint256 pos) public pure returns (PosLib.Position memory) {
        return PosLib.decode(pos);
    }
}
