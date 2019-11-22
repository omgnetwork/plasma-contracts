const rlp = require('rlp');
const { expect } = require('chai');
const { constants, expectRevert } = require('openzeppelin-test-helpers');
const { PaymentTransaction, PaymentTransactionOutput } = require('../../helpers/transaction.js');
const { OUTPUT_TYPE, DUMMY_INPUT_1 } = require('../../helpers/constants.js');

const PaymentTransactionModelMock = artifacts.require('PaymentTransactionModelMock');

const OUTPUT_GUARD = `0x${Array(40).fill(1).join('')}`;
const EMPTY_BYTES32 = `0x${Array(64).fill(0).join('')}`;
const OUTPUT = new PaymentTransactionOutput(OUTPUT_TYPE.PAYMENT, 100, OUTPUT_GUARD, constants.ZERO_ADDRESS);
const NULL_OUTPUT_GUARD = `0x${Array(40).fill(0).join('')}`;
const NULL_OUTPUT = new PaymentTransactionOutput(OUTPUT_TYPE.PAYMENT, 0, NULL_OUTPUT_GUARD, constants.ZERO_ADDRESS);

contract('PaymentTransactionModel', () => {
    const MAX_INPUT_NUM = 4;
    const MAX_OUTPUT_NUM = 4;

    before(async () => {
        this.test = await PaymentTransactionModelMock.new();
    });

    it('should decode payment transaction', async () => {
        const transaction = new PaymentTransaction(1, [DUMMY_INPUT_1], [OUTPUT, OUTPUT], EMPTY_BYTES32);
        const encoded = web3.utils.bytesToHex(transaction.rlpEncoded());

        const actual = await this.test.decode(encoded);
        const decoded = new PaymentTransaction(
            parseInt(actual.txType, 10),
            parseInputs(actual.inputs),
            parseOutputs(actual.outputs),
            actual.metaData,
        );

        expect(JSON.stringify(decoded)).to.equal(JSON.stringify(transaction));
    });

    it('should decode payment transaction with 4 inputs and 4 outputs', async () => {
        const transaction = new PaymentTransaction(
            1,
            [DUMMY_INPUT_1, DUMMY_INPUT_1, DUMMY_INPUT_1, DUMMY_INPUT_1],
            [OUTPUT, OUTPUT, OUTPUT, OUTPUT],
            EMPTY_BYTES32,
        );
        const encoded = web3.utils.bytesToHex(transaction.rlpEncoded());

        const actual = await this.test.decode(encoded);
        const decoded = new PaymentTransaction(
            parseInt(actual.txType, 10),
            parseInputs(actual.inputs),
            parseOutputs(actual.outputs),
            actual.metaData,
        );

        expect(JSON.stringify(decoded)).to.equal(JSON.stringify(transaction));
    });

    it('should fail when decoding transaction have more inputs than MAX_INPUT limit', async () => {
        const inputsExceedLimit = Array(MAX_INPUT_NUM + 1).fill(DUMMY_INPUT_1);
        const transaction = new PaymentTransaction(1, inputsExceedLimit, [], EMPTY_BYTES32);
        const encoded = web3.utils.bytesToHex(transaction.rlpEncoded());

        await expectRevert(
            this.test.decode(encoded),
            'Transaction inputs num exceeds limit',
        );
    });

    it('should fail when decoding transaction have more outputs than MAX_OUTPUT limit', async () => {
        const outputsExceedLimit = Array(MAX_OUTPUT_NUM + 1).fill(OUTPUT);
        const transaction = new PaymentTransaction(1, [DUMMY_INPUT_1], outputsExceedLimit, EMPTY_BYTES32);
        const encoded = web3.utils.bytesToHex(transaction.rlpEncoded());

        await expectRevert(
            this.test.decode(encoded),
            'Transaction outputs num exceeds limit',
        );
    });

    it('should fail when transaction does not contain metadata', async () => {
        const transaction = new PaymentTransaction(1, [DUMMY_INPUT_1], [OUTPUT, OUTPUT], EMPTY_BYTES32);

        const wireFormat = [
            transaction.transactionType,
            transaction.inputs,
            PaymentTransaction.formatForRlpEncoding(transaction.outputs),
        ];

        const encoded = web3.utils.bytesToHex(rlp.encode(wireFormat));

        await expectRevert(
            this.test.decode(encoded),
            'Invalid encoding of transaction',
        );
    });

    it('should fail when decoding invalid transaction', async () => {
        const encoded = web3.utils.bytesToHex(rlp.encode([0, 0]));

        await expectRevert(
            this.test.decode(encoded),
            'Invalid encoding of transaction',
        );
    });

    it('should fail when the transaction contains a null input', async () => {
        const transaction = new PaymentTransaction(1, [DUMMY_INPUT_1, EMPTY_BYTES32], [OUTPUT, OUTPUT], EMPTY_BYTES32);
        const encoded = web3.utils.bytesToHex(transaction.rlpEncoded());
        await expectRevert(this.test.decode(encoded), 'Empty input not allowed');
    });

    it('should fail when the transaction contains a null output', async () => {
        const transaction = new PaymentTransaction(1, [DUMMY_INPUT_1], [NULL_OUTPUT, OUTPUT], EMPTY_BYTES32);
        const encoded = web3.utils.bytesToHex(transaction.rlpEncoded());
        await expectRevert(this.test.decode(encoded), 'Empty output not allowed');
    });
});

function parseInputs(inputs) {
    return inputs.map(input => web3.eth.abi.decodeParameter('bytes32', input));
}

function parseOutputs(outputs) {
    return outputs.map(PaymentTransactionOutput.parseFromContractOutput);
}
