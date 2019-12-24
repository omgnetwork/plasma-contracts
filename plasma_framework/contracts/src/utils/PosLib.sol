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
        uint16 txIndex;
        uint16 outputIndex;
    }

    uint256 constant internal BLOCK_OFFSET = 1000000000;
    uint256 constant internal TX_OFFSET = 10000;
    
    uint256 constant internal MAX_OUTPUT_INDEX = TX_OFFSET - 1;
    // since we are using merkle tree of depth 16, max tx index size would be 2^16 - 1
    uint256 constant internal MAX_TX_INDEX = 2 ** 16 - 1;
    uint256 constant internal MAX_BLOCK_NUM = ((2 ** 256 - 1) - MAX_TX_INDEX * TX_OFFSET - MAX_OUTPUT_INDEX) / BLOCK_OFFSET;

    /**
     * @notice Returns transaction position which is an utxo position of zero index output
     * @param pos UTXO position of the output
     * @return Position of a transaction
     */
    function toStrictTxPos(Position memory pos)
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
        require(pos.outputIndex <= MAX_OUTPUT_INDEX, "Invalid output index");
        require(pos.blockNum <= MAX_BLOCK_NUM, "Invalid block number");

        return pos.blockNum.mul(BLOCK_OFFSET).add(uint256(pos.txIndex).mul(TX_OFFSET)).add(pos.outputIndex);
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

        // (BLOCK_OFFSET / TX_OFFSET) is larger than MAX_TX_INDEX (2 ^ 16 - 1)
        // thus the encoded position can potentially be with txIndex larger than uint16
        require(txIndex <= MAX_TX_INDEX, "txIndex should not exceed the size of uint16");
        return Position(blockNum, uint16(txIndex), outputIndex);
    }
}
