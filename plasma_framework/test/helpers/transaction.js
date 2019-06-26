const rlp = require('rlp');

const NULL_DATA = Buffer.alloc(32, 0);
const TransactionTypes = {
  PLASMA_DEPOSIT: 1
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
    constructor(transactionType, inputs, outputs, metaData = NULL_DATA) {
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
    constructor(output, metaData = NULL_DATA) {
        super(TransactionTypes.PLASMA_DEPOSIT, [NULL_DATA], [output], metaData);
    }
}

module.exports.Transaction = Transaction
module.exports.PlasmaDepositTransaction = PlasmaDepositTransaction
module.exports.TransactionOutput = TransactionOutput
