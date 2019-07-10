const { constants } = require('openzeppelin-test-helpers');
const { PaymentTransactionOutput, PlasmaDepositTransaction } = require('./transaction.js');

function deposit(amount, owner, tokenAddress = constants.ZERO_ADDRESS) {
    const output = new PaymentTransactionOutput(amount, owner, tokenAddress);
    const depositTx = new PlasmaDepositTransaction(output);
    return web3.utils.bytesToHex(depositTx.rlpEncoded());
}

function buildUtxoPos(blockNum, txIndex, outputIndex) {
    const BLOCK_OFFSET = 1000000000;
    const TX_OFFSET = 10000;
    return blockNum * BLOCK_OFFSET + txIndex * TX_OFFSET + outputIndex;
}

module.exports.deposit = deposit;
module.exports.buildUtxoPos = buildUtxoPos;
