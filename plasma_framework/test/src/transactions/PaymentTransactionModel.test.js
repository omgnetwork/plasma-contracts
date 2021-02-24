const rlp = require('rlp');
const { expect } = require('chai');
const { constants, expectRevert } = require('openzeppelin-test-helpers');
const { PaymentTransaction, FungibleTransactionOutput } = require('../../helpers/transaction.js');
const {
    TX_TYPE, OUTPUT_TYPE, DUMMY_INPUT_1, EMPTY_BYTES_32,
} = require('../../helpers/constants.js');

const PaymentTransactionModelMock = artifacts.require('PaymentTransactionModelMock');

const OUTPUT_GUARD = `0x${Array(40).fill(1).join('')}`;
const OUTPUT = new FungibleTransactionOutput(OUTPUT_TYPE.PAYMENT, 100, OUTPUT_GUARD, constants.ZERO_ADDRESS);

contract('PaymentTransactionModel', ([alice]) => {
    const MAX_INPUT_NUM = 4;
    const MAX_OUTPUT_NUM = 5;

    before(async () => {
        this.test = await PaymentTransactionModelMock.new();
    });

    describe('decode', () => {
        it('should decode payment transaction', async () => {
            const transaction = new PaymentTransaction(
                TX_TYPE.PAYMENT, [DUMMY_INPUT_1], [OUTPUT, OUTPUT], EMPTY_BYTES_32,
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

        it('should decode payment transaction with 4 inputs and 4 outputs', async () => {
            const transaction = new PaymentTransaction(
                TX_TYPE.PAYMENT,
                [DUMMY_INPUT_1, DUMMY_INPUT_1, DUMMY_INPUT_1, DUMMY_INPUT_1],
                [OUTPUT, OUTPUT, OUTPUT, OUTPUT],
                EMPTY_BYTES_32,
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
            const transaction = new PaymentTransaction(TX_TYPE.PAYMENT, inputsExceedLimit, [], EMPTY_BYTES_32);
            const encoded = web3.utils.bytesToHex(transaction.rlpEncoded());

            await expectRevert(
                this.test.decode(encoded),
                'Transaction inputs num exceeds limit',
            );
        });

        it('should fail when decoding transaction have more outputs than MAX_OUTPUT limit', async () => {
            const outputsExceedLimit = Array(MAX_OUTPUT_NUM + 1).fill(OUTPUT);
            const transaction = new PaymentTransaction(
                TX_TYPE.PAYMENT, [DUMMY_INPUT_1], outputsExceedLimit, EMPTY_BYTES_32,
            );
            const encoded = web3.utils.bytesToHex(transaction.rlpEncoded());

            await expectRevert(
                this.test.decode(encoded),
                'Transaction outputs num exceeds limit',
            );
        });

        it('should fail when transaction does not contain metadata', async () => {
            const transaction = new PaymentTransaction(
                TX_TYPE.PAYMENT, [DUMMY_INPUT_1], [OUTPUT, OUTPUT], EMPTY_BYTES_32,
            );

            const genericFormat = [
                transaction.transactionType,
                transaction.inputs,
                PaymentTransaction.formatOutputsForRlpEncoding(transaction.outputs),
            ];

            const encoded = web3.utils.bytesToHex(rlp.encode(genericFormat));

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
            const transaction = new PaymentTransaction(
                TX_TYPE.PAYMENT, [DUMMY_INPUT_1, EMPTY_BYTES_32], [OUTPUT, OUTPUT], EMPTY_BYTES_32,
            );
            const encoded = web3.utils.bytesToHex(transaction.rlpEncoded());
            await expectRevert(this.test.decode(encoded), 'Null input not allowed');
        });

        it('should fail when the transaction type is zero', async () => {
            const transaction = new PaymentTransaction(0, [DUMMY_INPUT_1], [OUTPUT], EMPTY_BYTES_32);
            const encoded = web3.utils.bytesToHex(transaction.rlpEncoded());
            await expectRevert(this.test.decode(encoded), 'Transaction type must not be 0');
        });

        it('should fail when an output type is zero', async () => {
            const zeroOutputType = new FungibleTransactionOutput(0, 100, OUTPUT_GUARD, constants.ZERO_ADDRESS);
            const transaction = new PaymentTransaction(
                TX_TYPE.PAYMENT, [DUMMY_INPUT_1], [OUTPUT, zeroOutputType], EMPTY_BYTES_32,
            );
            const encoded = web3.utils.bytesToHex(transaction.rlpEncoded());
            await expectRevert(this.test.decode(encoded), 'Output type must not be 0');
        });

        it('should fail when an output amount is zero', async () => {
            const zeroOutputAmount = new FungibleTransactionOutput(
                OUTPUT_TYPE.PAYMENT, 0, OUTPUT_GUARD, constants.ZERO_ADDRESS,
            );
            const transaction = new PaymentTransaction(
                TX_TYPE.PAYMENT, [DUMMY_INPUT_1], [OUTPUT, zeroOutputAmount], EMPTY_BYTES_32,
            );
            const encoded = web3.utils.bytesToHex(transaction.rlpEncoded());
            await expectRevert(this.test.decode(encoded), 'Output amount must not be 0');
        });

        it('should fail when txData is not zero', async () => {
            const output = new FungibleTransactionOutput(
                OUTPUT_TYPE.PAYMENT, 1, OUTPUT_GUARD, constants.ZERO_ADDRESS,
            );
            const encoded = rlp.encode([
                TX_TYPE.PAYMENT, [], [output.formatForRlpEncoding()], 1, EMPTY_BYTES_32,
            ]);

            await expectRevert(this.test.decode(encoded), 'txData must be 0');
        });

        it('should fail when the transaction has no outputs', async () => {
            const transaction = new PaymentTransaction(
                TX_TYPE.PAYMENT, [DUMMY_INPUT_1], [], EMPTY_BYTES_32,
            );
            const encoded = web3.utils.bytesToHex(transaction.rlpEncoded());
            await expectRevert(this.test.decode(encoded), 'Transaction cannot have 0 outputs');
        });
    });

    describe('getOutputOwner', () => {
        it('should parse the owner address from output guard when output guard holds the owner info directly', async () => {
            expect(await this.test.getOutputOwner(
                OUTPUT_TYPE.PAYMENT, alice, constants.ZERO_ADDRESS, 100,
            )).to.equal(alice);
        });
    });

    describe('getOutput', () => {
        before(async () => {
            const transaction = new PaymentTransaction(
                TX_TYPE.PAYMENT, [DUMMY_INPUT_1], [OUTPUT, OUTPUT], EMPTY_BYTES_32,
            );
            this.encodedTx = web3.utils.bytesToHex(transaction.rlpEncoded());
        });

        it('should get output', async () => {
            const output = await this.test.getOutput(this.encodedTx, 1);
            const actual = new FungibleTransactionOutput(
                parseInt(output.outputType, 10), parseInt(output.amount, 10), output.outputGuard, output.token,
            );
            expect(JSON.stringify(actual)).to.equal(JSON.stringify(OUTPUT));
        });

        it('should fail when output index is out of bounds', async () => {
            await expectRevert(
                this.test.getOutput(this.encodedTx, 3),
                'Output index out of bounds',
            );
        });
    });
});

function parseInputs(inputs) {
    return inputs.map(input => web3.eth.abi.decodeParameter('bytes32', input));
}

function parseOutputs(outputs) {
    return outputs.map(FungibleTransactionOutput.parseFromContractOutput);
}
