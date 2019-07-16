const assert = require('assert');

const BLOCK_OFFSET = 1000000000;
const TX_OFFSET = 10000;

function buildUtxoPos(blockNum, txIndex, outputIndex) {
    return blockNum * BLOCK_OFFSET + txIndex * TX_OFFSET + outputIndex;
}

class UtxoPos {
    constructor(utxoPos) {
        this.utxoPos = utxoPos;
        this.blockNum = Math.floor(this.utxoPos / BLOCK_OFFSET);
        this.txIndex = Math.floor((this.utxoPos % BLOCK_OFFSET) / TX_OFFSET);
        this.outputIndex = this.utxoPos % TX_OFFSET;

        assert(this.outputIndex < 256, 'output index should be less then 2^8');
    }
}

module.exports = {
    buildUtxoPos,
    UtxoPos,
};
