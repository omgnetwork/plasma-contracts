const { constants } = require('openzeppelin-test-helpers');
const { PaymentTransactionOutput, PlasmaDepositTransaction } = require('./transaction.js');

function deposit(outputType, amount, owner, tokenAddress = constants.ZERO_ADDRESS) {
    const output = new PaymentTransactionOutput(outputType, amount, owner, tokenAddress);
    const depositTx = new PlasmaDepositTransaction(output);
    return web3.utils.bytesToHex(depositTx.rlpEncoded());
}

module.exports = {
    deposit,
};
