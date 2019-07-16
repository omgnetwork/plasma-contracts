const rlp = require('rlp');

const EMPTY_BYTES32 = `0x${Array(64).fill(0).join('')}`;
const TransactionTypes = {
    PLASMA_DEPOSIT: 1,
};

class PaymentTransactionOutput {
    constructor(amount, owner, token) {
        this.amount = amount;
        this.outputGuard = owner;
        this.token = token;
    }

    formatForRlpEncoding() {
        return [this.amount, this.outputGuard, this.token];
    }

    rlpEncoded() {
        return rlp.encode(this.formatForRlpEncoding());
    }

    static parseFromContractOutput(output) {
        const amount = parseInt(output.amount, 10);
        const outputGuard = web3.eth.abi.decodeParameter('bytes32', output.outputGuard);
        return new PaymentTransactionOutput(amount, outputGuard, output.token);
    }
}

class PaymentTransaction {
    constructor(transactionType, inputs, outputs, metaData = EMPTY_BYTES32) {
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
}

class PlasmaDepositTransaction extends PaymentTransaction {
    constructor(output, metaData = EMPTY_BYTES32) {
        super(TransactionTypes.PLASMA_DEPOSIT, [0], [output], metaData);
    }
}

module.exports = {
    PaymentTransaction,
    PlasmaDepositTransaction,
    PaymentTransactionOutput,
};
