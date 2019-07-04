const { constants } = require('openzeppelin-test-helpers');
const { PaymentTransactionOutput, PlasmaDepositTransaction } = require('./transaction.js');

function deposit(amount, owner, tokenAddress = constants.ZERO_ADDRESS) {
    const output = new PaymentTransactionOutput(amount, owner, tokenAddress);
    const depositTx = new PlasmaDepositTransaction(output);
    return depositTx.rlpEncoded();
}

module.exports.deposit = deposit;
