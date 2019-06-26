const { PaymentTransactionOutput, PlasmaDepositTransaction} = require("./transaction.js");

const { constants } = require('openzeppelin-test-helpers');

function deposit(amount, owner, tokenAddress = constants.ZERO_ADDRESS) {
    const output = new PaymentTransactionOutput(amount, owner, tokenAddress);
    const deposit = new PlasmaDepositTransaction(output);
    return deposit.rlpEncoded();
}

module.exports.deposit = deposit;
