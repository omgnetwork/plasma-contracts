pragma solidity 0.5.11;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/**
 * @dev UTXO position = (blockNumber * BLOCK_OFFSET + txIndex * TX_OFFSET + outputIndex).
 * TX position = (blockNumber * BLOCK_OFFSET + txIndex * TX_OFFSET)
 */
library PosLib {
    using SafeMath for uint256;

    struct Position {
        uint256 blockNum;
        uint256 txIndex;
        uint16 outputIndex;
    }

    uint256 constant internal BLOCK_OFFSET = 1000000000;
    uint256 constant internal TX_OFFSET = 10000;

    /**
     * @notice Returns the UTXO position for a given transaction position and output index
     * @param txPos Transaction position - utxo position of zero index output
     * @param outputIndex Index of the output
     * @return utxo position
     */
    function buildPositionFromTxPosAndOutputIndex(uint256 txPos, uint16 outputIndex)
        internal
        pure
        returns (Position memory)
    {
        require(txPos % TX_OFFSET == 0, "Invalid transaction position");
        return decode(txPos.add(outputIndex));
    }

    /**
     * @notice Returns transaction position which is an utxo position of zero index output
     * @param pos UTXO position of the output
     * @return Position of a transaction
     */
    function txPos(Position memory pos)
        internal
        pure
        returns (Position memory)
    {
        return Position(pos.blockNum, pos.txIndex, 0);
    }

    /**
     * @notice Used for calculating exit priority
     * @param pos UTXO position for the output
     * @return Identifier of the transaction
     */
    function getTxPostionForExitPriority(Position memory pos)
        internal
        pure
        returns (uint256)
    {
        return encode(pos) / TX_OFFSET;
    }

    /**
     * @notice Encodes a position
     * @param pos Position
     * @return Position encoded as an integer
     */
    function encode(Position memory pos) internal pure returns (uint256) {
        return pos.blockNum * BLOCK_OFFSET + pos.txIndex * TX_OFFSET + pos.outputIndex;
    }

    /**
     * @notice Encodes a transaction position
     * @param pos Transaction position
     * @return Position encoded as an integer
     */
    function encodePackedTxPos(Position memory pos) internal pure returns (uint256) {
        require(pos.outputIndex == 0, "Invalid transaction position");
        return pos.blockNum * BLOCK_OFFSET + pos.txIndex * TX_OFFSET;
    }

    /**
     * @notice Decodes a position from an integer value
     * @param pos Encoded position
     * @return Position
     */
    function decode(uint256 pos) internal pure returns (Position memory) {
        uint256 blockNum = pos / BLOCK_OFFSET;
        uint256 txIndex = (pos % BLOCK_OFFSET) / TX_OFFSET;
        uint16 outputIndex = uint16(pos % TX_OFFSET);
        return Position(blockNum, txIndex, outputIndex);
    }
}
