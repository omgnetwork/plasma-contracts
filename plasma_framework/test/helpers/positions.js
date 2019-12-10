const BLOCK_OFFSET = 1000000000;
const TX_OFFSET = 10000;

function buildUtxoPos(blockNum, txIndex, outputIndex) {
    return blockNum * BLOCK_OFFSET + txIndex * TX_OFFSET + outputIndex;
}

function buildTxPos(blockNum, txIndex) {
    return blockNum * BLOCK_OFFSET + txIndex * TX_OFFSET;
}

function utxoPosToTxPos(utxoPos) {
    return utxoPos - (utxoPos % TX_OFFSET);
}

function txPostionForExitPriority(utxoPos) {
    return Math.floor(utxoPos / TX_OFFSET);
}

class UtxoPos {
    constructor(utxoPos) {
        this.utxoPos = utxoPos;
        this.blockNum = Math.floor(this.utxoPos / BLOCK_OFFSET);
        this.txIndex = Math.floor((this.utxoPos % BLOCK_OFFSET) / TX_OFFSET);
        this.outputIndex = this.utxoPos % TX_OFFSET;
        this.txPos = buildTxPos(this.blockNum, this.txIndex);
    }
}

module.exports = {
    buildUtxoPos,
    buildTxPos,
    utxoPosToTxPos,
    txPostionForExitPriority,
    UtxoPos,
};
