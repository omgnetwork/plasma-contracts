pragma solidity 0.5.11;

/**
 * @dev Transaction position = (blockNumber * BLOCK_OFFSET_FOR_TX_POS + txIndex)
 */
library TxPosLib {
    struct TxPos {
        uint256 value;
    }

    uint256 constant internal BLOCK_OFFSET_FOR_TX_POS = 1000000000 / 10000;

    /**
     * @notice Returns the block number for a given a tx position
     * @param _txPos Position of the transaction
     * @return Block number of the output
     */
    function blockNum(TxPos memory _txPos)
        internal
        pure
        returns (uint256)
    {
        return _txPos.value / BLOCK_OFFSET_FOR_TX_POS;
    }

    /**
     * @notice Returns the transaction index for a given tx position
     * @param _txPos Position of the transaction
     * @return Transaction index of the output
     */
    function txIndex(TxPos memory _txPos)
        internal
        pure
        returns (uint256)
    {
        return _txPos.value % BLOCK_OFFSET_FOR_TX_POS;
    }
}
