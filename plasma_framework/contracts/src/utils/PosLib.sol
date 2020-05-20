pragma solidity 0.5.11;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/**
 * @dev UTXO position = (blknum * BLOCK_OFFSET + txIndex * TX_OFFSET + outputIndex).
 * TX position = (blknum * BLOCK_OFFSET + txIndex * TX_OFFSET)
 */
library PosLib {
    struct Position {
        uint64 blockNum;
        uint16 txIndex;
        uint16 outputIndex;
    }

    uint256 constant internal BLOCK_OFFSET = 1000000000;
    uint256 constant internal TX_OFFSET = 10000;
    
    uint256 constant internal MAX_OUTPUT_INDEX = TX_OFFSET - 1;
    // Since we are using a merkle tree of depth 16, max tx index size is 2^16 - 1
    uint256 constant internal MAX_TX_INDEX = 2 ** 16 - 1;
    // The maximum block number we can handle depends on ExitPriority. ExitPriority only uses 54 bits for blockNum + txIndex
    // This is 180143985094 blocks, which works out to be 85 years of blocks (given a block every 15 seconds)
    uint256 constant internal MAX_BLOCK_NUM = ((2 ** 54 - 1) - MAX_TX_INDEX) / (BLOCK_OFFSET / TX_OFFSET);

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
    function getTxPositionForExitPriority(Position memory pos)
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

        return pos.blockNum * BLOCK_OFFSET + pos.txIndex * TX_OFFSET + pos.outputIndex;
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

        require(blockNum <= MAX_BLOCK_NUM, "blockNum exceeds max size allowed in PlasmaFramework");
        require(txIndex <= MAX_TX_INDEX, "txIndex exceeds the size of uint16");
        return Position(uint64(blockNum), uint16(txIndex), outputIndex);
    }
}
