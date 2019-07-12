const { constants } = require('openzeppelin-test-helpers');
const { PaymentTransactionOutput, PlasmaDepositTransaction } = require('./transaction.js');
const { addressToOutputGuard } = require('./utils.js');

function deposit(amount, owner, tokenAddress = constants.ZERO_ADDRESS) {
    // if passed in with address format, auto transform to outputGuard format
    const outputGuard = owner.length < 66 ? addressToOutputGuard(owner) : owner;
    const output = new PaymentTransactionOutput(amount, outputGuard, tokenAddress);
    const depositTx = new PlasmaDepositTransaction(output);
    return web3.utils.bytesToHex(depositTx.rlpEncoded());
}

module.exports = {
    deposit,
};
