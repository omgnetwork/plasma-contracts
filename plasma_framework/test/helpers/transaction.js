const rlp = require('rlp');

const NULL_DATA = Buffer.alloc(32, 0);
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

    static parseFromContractOutput(output) {
        const amount = parseInt(output.amount, 10);
        const outputGuard = web3.eth.abi.decodeParameter('bytes32', output.outputGuard);
        return new PaymentTransactionOutput(amount, outputGuard, output.token);
    }
}

class PaymentTransaction {
    constructor(transactionType, inputs, outputs, metaData = NULL_DATA) {
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
    constructor(output, metaData = NULL_DATA) {
        super(TransactionTypes.PLASMA_DEPOSIT, [NULL_DATA], [output], metaData);
    }
}

module.exports.PaymentTransaction = PaymentTransaction;
module.exports.PlasmaDepositTransaction = PlasmaDepositTransaction;
module.exports.PaymentTransactionOutput = PaymentTransactionOutput;
