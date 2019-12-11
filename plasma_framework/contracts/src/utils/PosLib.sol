pragma solidity 0.5.11;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/**
 * @dev UTXO position = (blockNumber * BLOCK_OFFSET + txIndex * TX_OFFSET + outputIndex).
 * TX position = (blockNumber * BLOCK_OFFSET + txIndex * TX_OFFSET)
 */
library PosLib {
    using SafeMath for uint256;

    struct Position {
        uint256 value;
    }

    uint256 constant internal BLOCK_OFFSET = 1000000000;
    uint256 constant internal TX_OFFSET = 10000;

    /**
     * @notice Returns the UTXO struct for a given txPos and outputIndex
     * @param txPos Transaction position - utxo of zero index output
     * @param outputIndex Transaction index of the output
     * @return Position of the relevant value
     */
    function build(uint256 txPos, uint16 outputIndex)
        internal
        pure
        returns (Position memory)
    {
        require(txPos % TX_OFFSET == 0, "Invalid transaction position");
        return Position(txPos.add(outputIndex));
    }

    /**
     * @notice Returns the block number of a given UTXO position
     * @param _utxoPos UTXO position identifier for the output
     * @return The block number of the output
     */
    function blockNum(Position memory _utxoPos)
        internal
        pure
        returns (uint256)
    {
        return _utxoPos.value / BLOCK_OFFSET;
    }

    /**
     * @notice Returns the transaction index of a given UTXO position
     * @param _utxoPos UTXO position identifier for the output
     * @return Transaction index of the output
     */
    function txIndex(Position memory _utxoPos)
        internal
        pure
        returns (uint256)
    {
        return (_utxoPos.value % BLOCK_OFFSET) / TX_OFFSET;
    }

    /**
     * @notice Returns the output index of a given UTXO position
     * @param _utxoPos UTXO position identifier for the output
     * @return Index of the output
     */
    function outputIndex(Position memory _utxoPos)
        internal
        pure
        returns (uint16)
    {
        return uint16(_utxoPos.value % TX_OFFSET);
    }

    /**
     * @notice Returns transaction position which is a utxo position of zero index output
     * @param _utxoPos UTXO position identifier for the output
     * @return Identifier of the transaction
     */
    function txPos(Position memory _utxoPos)
        internal
        pure
        returns (Position memory)
    {
        uint16 oindex = outputIndex(_utxoPos);
        return Position(_utxoPos.value.sub(oindex));
    }

     /**
     * @notice Used for calculating exit priority
     * @param _utxoPos UTXO position identifier for the output
     * @return Identifier of the transaction
     */
    function getTxPostionForExitPriority(Position memory _utxoPos)
        internal
        pure
        returns (uint256)
    {
        return _utxoPos.value / TX_OFFSET;
    }
}
