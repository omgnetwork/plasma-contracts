const TransactionOutput = require("./transaction.js").TransactionOutput
const PlasmaDepositTransaction = require("./transaction.js").PlasmaDepositTransaction

const { constants } = require('openzeppelin-test-helpers');

function deposit(amount, owner, tokenAddress = constants.ZERO_ADDRESS) {
    const output = new TransactionOutput(amount, owner, tokenAddress);
    const deposit = new PlasmaDepositTransaction(output);
    return deposit.rlpEncoded();
}

module.exports.deposit = deposit;
