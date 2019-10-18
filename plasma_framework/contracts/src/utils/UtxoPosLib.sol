pragma solidity 0.5.11;

import "./TxPosLib.sol";

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/**
 * @dev UTXO position = (blockNumber * BLOCK_OFFSET + txIndex * TX_OFFSET + outputIndex).
 */
library UtxoPosLib {
    using SafeMath for uint256;

    struct UtxoPos {
        uint256 value;
    }

    uint256 constant internal BLOCK_OFFSET = 1000000000;
    uint256 constant internal TX_OFFSET = 10000;

    /**
     * @notice Returns the UTXO struct for a given txPos and outputIndex
     * @param txPos Transaction position
     * @param outputIndex Transaction index of the output
     * @return UtxoPos of the relevant value
     */
    function build(TxPosLib.TxPos memory txPos, uint16 outputIndex)
        internal
        pure
        returns (UtxoPos memory)
    {
        return UtxoPos(txPos.value.mul(TX_OFFSET).add(outputIndex));
    }

    /**
     * @notice Returns the block number of a given UTXO position
     * @param _utxoPos UTXO position identifier for the output
     * @return The block number of the output
     */
    function blockNum(UtxoPos memory _utxoPos)
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
    function txIndex(UtxoPos memory _utxoPos)
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
    function outputIndex(UtxoPos memory _utxoPos)
        internal
        pure
        returns (uint16)
    {
        return uint16(_utxoPos.value % TX_OFFSET);
    }

    /**
     * @notice Returns the transaction position of a given UTXO position
     * @param _utxoPos UTXO position identifier for the output
     * @return Position of the transaction
     */
    function txPos(UtxoPos memory _utxoPos)
        internal
        pure
        returns (TxPosLib.TxPos memory)
    {
        return TxPosLib.TxPos(_utxoPos.value / TX_OFFSET);
    }
}
