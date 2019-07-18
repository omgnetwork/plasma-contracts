pragma solidity ^0.5.0;

import "./TxPosLib.sol";

/**
@dev UTXO position = (blockNumber * BLOCK_OFFSET + txIndex * TX_OFFSET + outputIndex).
 */
library UtxoPosLib {
    struct UtxoPos {
        uint256 value;
    }

    uint256 constant internal BLOCK_OFFSET = 1000000000;
    uint256 constant internal TX_OFFSET = 10000;

    /**
     * @notice Given an UTXO position, returns the block number.
     * @param _utxoPos Output identifier in form of utxo position.
     * @return The output's block number.
     */
    function blockNum(UtxoPos memory _utxoPos)
        internal
        pure
        returns (uint256)
    {
        return _utxoPos.value / BLOCK_OFFSET;
    }

    /**
     * @notice Given an UTXO position, returns the transaction index.
     * @param _utxoPos Output identifier in form of utxo position.
     * @return The output's transaction index.
     */
    function txIndex(UtxoPos memory _utxoPos)
        internal
        pure
        returns (uint256)
    {
        return (_utxoPos.value % BLOCK_OFFSET) / TX_OFFSET;
    }

    /**
     * @notice Given an UTXO position, returns the output index.
     * @param _utxoPos Output identifier in form of utxo position.
     * @return The output's index.
     */
    function outputIndex(UtxoPos memory _utxoPos)
        internal
        pure
        returns (uint16)
    {
        return uint16(_utxoPos.value % TX_OFFSET);
    }

    /**
     * @notice Given an UTXO position, returns transaction position.
     * @param _utxoPos Output identifier in form of utxo position.
     * @return The transaction position.
     */
    function txPos(UtxoPos memory _utxoPos)
        internal
        pure
        returns (TxPosLib.TxPos memory)
    {
        return TxPosLib.TxPos(_utxoPos.value / TX_OFFSET);
    }
}
