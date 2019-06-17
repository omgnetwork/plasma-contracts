const rlp = require('rlp');

const NullData = Buffer.alloc(32, 0);
const TransactionTypes = {
  PlasmaDeposit: 1
}

class TransactionOutput {
    constructor(amount, owner, token) {
        this.amount = amount;
        this.outputGuard = owner;
        this.token = token;
    }

    formatForRlpEncoding() {
        return [this.amount, this.outputGuard, this.token]
    }
}

class Transaction {
    constructor(transactionType, inputs, outputs, metaData = NullData) {
        this.transactionType = transactionType;
        this.inputs = inputs;
        this.outputs = outputs;
        this.metaData = metaData;
    }

    rlpEncoded() {
        const tx = [this.transactionType];

        tx.push(this.inputs);
        tx.push(Transaction.formatForRlpEncoding(this.outputs));
        tx.push(this.metaData);

        return rlp.encode(tx);
    }

    static formatForRlpEncoding(items) {
        return items.map(item => item.formatForRlpEncoding());
    }
}

class PlasmaDepositTransaction extends Transaction {
    constructor(output, metaData = NullData) {
        super(TransactionTypes.PlasmaDeposit, [NullData], [output], metaData);
    }
}

module.exports.Transaction = Transaction
module.exports.PlasmaDepositTransaction = PlasmaDepositTransaction
module.exports.TransactionOutput = TransactionOutput
