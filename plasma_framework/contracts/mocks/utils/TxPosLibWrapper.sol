pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/utils/TxPosLib.sol";

contract TxPosLibWrapper {
    using TxPosLib for TxPosLib.TxPos;

    function blockNum(uint256 _txPos) public pure returns (uint256) {
        return TxPosLib.TxPos(_txPos).blockNum();
    }

    function txIndex(uint256 _txPos) public pure returns (uint256) {
        return TxPosLib.TxPos(_txPos).txIndex();
    }
}
