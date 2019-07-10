function buildUtxoPos(blockNum, txIndex, outputIndex) {
    const BLOCK_OFFSET = 1000000000;
    const TX_OFFSET = 10000;
    return blockNum * BLOCK_OFFSET + txIndex * TX_OFFSET + outputIndex;
}

class UtxoPos {
    constructor(utxoPos) {
        this.utxoPos = utxoPos;
        this.BLOCK_OFFSET = 1000000000;
        this.TX_OFFSET = 10000;
    }

    blockNum() {
        return Math.floor(this.utxoPos / this.BLOCK_OFFSET);
    }

    txIndex() {
        return Math.floor((this.utxoPos % this.BLOCK_OFFSET) / this.TX_OFFSET);
    }

    outputIndex() {
        return this.utxoPos % this.TX_OFFSET;
    }
}

module.exports = {
    buildUtxoPos,
    UtxoPos,
};
