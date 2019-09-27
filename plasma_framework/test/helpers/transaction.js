const rlp = require('rlp');
const { EMPTY_BYTES_32, OUTPUT_TYPE } = require('../helpers/constants.js');

const TransactionTypes = {
    PLASMA_DEPOSIT: 1,
};

class PaymentTransactionOutput {
    constructor(amount, owner, token, type = OUTPUT_TYPE.PAYMENT) {
        this.outputType = type;
        this.outputGuard = owner;
        this.token = token;
        this.amount = amount;
    }

    formatForRlpEncoding() {
        return [this.outputType, this.outputGuard, this.token, this.amount];
    }

    rlpEncoded() {
        return rlp.encode(this.formatForRlpEncoding());
    }

    static parseFromContractOutput(output) {
        const amount = parseInt(output.amount, 10);
        const outputType = parseInt(output.outputType, 10);
        return new PaymentTransactionOutput(amount, output.outputGuard, output.token, outputType);
    }
}

class PaymentTransaction {
    constructor(transactionType, inputs, outputs, metaData = EMPTY_BYTES_32) {
        this.transactionType = transactionType;
        this.inputs = inputs;
        this.outputs = outputs;
        this.metaData = metaData;
    }

    rlpEncoded() {
        const tx = [this.transactionType];

        tx.push(this.inputs);
        tx.push(PaymentTransaction.formatForRlpEncoding(this.outputs));
        tx.push(this.metaData);

        return rlp.encode(tx);
    }

    static formatForRlpEncoding(items) {
        return items.map(item => item.formatForRlpEncoding());
    }

    isDeposit() {
        return this.inputs === [];
    }
}

class PlasmaDepositTransaction extends PaymentTransaction {
    constructor(output, metaData = EMPTY_BYTES_32) {
        super(TransactionTypes.PLASMA_DEPOSIT, [], [output], metaData);
    }
}

module.exports = {
    PaymentTransaction,
    PlasmaDepositTransaction,
    PaymentTransactionOutput,
};
