pragma solidity 0.5.11;

/**
@dev transaction position = (blockNumber * BLOCK_OFFSET_FOR_TX_POS + txIndex).
 */
library TxPosLib {
    struct TxPos {
        uint256 value;
    }

    uint256 constant internal BLOCK_OFFSET_FOR_TX_POS = 1000000000 / 10000;

    /**
     * @notice Given a TX position, returns the block number.
     * @param _txPos position of transaction.
     * @return The output's block number.
     */
    function blockNum(TxPos memory _txPos)
        internal
        pure
        returns (uint256)
    {
        return _txPos.value / BLOCK_OFFSET_FOR_TX_POS;
    }

    /**
     * @notice Given a Tx position, returns the transaction index.
     * @param _txPos position of transaction.
     * @return The output's transaction index.
     */
    function txIndex(TxPos memory _txPos)
        internal
        pure
        returns (uint256)
    {
        return _txPos.value % BLOCK_OFFSET_FOR_TX_POS;
    }
}
