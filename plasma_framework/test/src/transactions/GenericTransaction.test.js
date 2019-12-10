const GenericTransaction = artifacts.require('GenericTransactionWrapper.sol');
const rlp = require('rlp');
const { expect } = require('chai');
const { BN, expectRevert } = require('openzeppelin-test-helpers');
const { EMPTY_BYTES_32, TX_TYPE, OUTPUT_TYPE } = require('../../helpers/constants');

contract('GenericTransaction', () => {
    before(async () => {
        this.test = await GenericTransaction.new();
    });

    describe('decode', async () => {
        it('should decode a correctly formatted transaction', async () => {
            const encoded = rlp.encode([
                TX_TYPE.PAYMENT,
                ['input0', 'input2'],
                [[OUTPUT_TYPE.PAYMENT, 'Output data']],
                EMPTY_BYTES_32,
            ]);

            const decoded = await this.test.decode(encoded);
            expect(new BN(decoded.txType)).to.be.bignumber.equal(new BN(TX_TYPE.PAYMENT));
        });

        it('should decode a correctly formatted transaction with no inputs or outputs', async () => {
            const encoded = rlp.encode([
                TX_TYPE.PAYMENT,
                [],
                [],
                EMPTY_BYTES_32,
            ]);

            const decoded = await this.test.decode(encoded);
            expect(new BN(decoded.txType)).to.be.bignumber.equal(new BN(TX_TYPE.PAYMENT));
        });

        it('should decode a correctly formatted transaction different output types', async () => {
            const encoded = rlp.encode([
                TX_TYPE.PAYMENT,
                ['input0', 'input2'],
                [[42, 'single_field_only'], [123, ['first_field', 'second_field', ['more fields here']]]],
                EMPTY_BYTES_32,
            ]);

            const decoded = await this.test.decode(encoded);
            expect(new BN(decoded.txType)).to.be.bignumber.equal(new BN(TX_TYPE.PAYMENT));
        });

        it('should decode a correctly formatted transaction with extra txData', async () => {
            const encoded = rlp.encode([
                TX_TYPE.PAYMENT,
                ['input0', 'input2'],
                [[OUTPUT_TYPE.PAYMENT, 'Output data']],
                ['More data', 98765, ['lots', 'of', 'data']],
            ]);

            const decoded = await this.test.decode(encoded);
            expect(new BN(decoded.txType)).to.be.bignumber.equal(new BN(TX_TYPE.PAYMENT));
        });

        it('should fail when not enough items', async () => {
            const invalidTx = rlp.encode([
                TX_TYPE.PAYMENT,
                ['input0', 'input2'],
                [[OUTPUT_TYPE.PAYMENT, 'Output data']],
            ]);
            await expectRevert(
                this.test.decode(invalidTx),
                'Invalid encoding of transaction',
            );
        });

        it('should fail when too many items', async () => {
            const invalidTx = rlp.encode([
                TX_TYPE.PAYMENT,
                ['input0', 'input2'],
                [[OUTPUT_TYPE.PAYMENT, 'Output data']],
                EMPTY_BYTES_32,
                'Extra item',
            ]);
            await expectRevert(
                this.test.decode(invalidTx),
                'Invalid encoding of transaction',
            );
        });

        it('should fail when tx type is 0', async () => {
            const invalidTx = rlp.encode([
                0,
                ['input0', 'input2'],
                [[OUTPUT_TYPE.PAYMENT, 'Output data']],
                EMPTY_BYTES_32,
            ]);
            await expectRevert(
                this.test.decode(invalidTx),
                'Transaction type must not be 0',
            );
        });

        it('should fail when output type is 0', async () => {
            const invalidTx = rlp.encode([
                TX_TYPE.PAYMENT,
                ['input0', 'input2'],
                [[0, 'Output data']],
                EMPTY_BYTES_32,
            ]);
            await expectRevert(
                this.test.decode(invalidTx),
                'Output type must not be 0',
            );
        });

        it('should fail when not enough items in output', async () => {
            const invalidTx = rlp.encode([
                TX_TYPE.PAYMENT,
                ['input0', 'input2'],
                [[OUTPUT_TYPE.PAYMENT]],
                EMPTY_BYTES_32,
            ]);
            await expectRevert(
                this.test.decode(invalidTx),
                'Output must have 2 items',
            );
        });

        it('should fail when too many items in output', async () => {
            const invalidTx = rlp.encode([
                TX_TYPE.PAYMENT,
                ['input0', 'input2'],
                [[OUTPUT_TYPE.PAYMENT, 'Output data', 'More Output data']],
                EMPTY_BYTES_32,
            ]);
            await expectRevert(
                this.test.decode(invalidTx),
                'Output must have 2 items',
            );
        });

        it('should fail when txType is a list', async () => {
            const invalidTx = rlp.encode([
                [TX_TYPE.PAYMENT],
                ['input0', 'input2'],
                [[OUTPUT_TYPE.PAYMENT, 'Output data']],
                EMPTY_BYTES_32,
            ]);
            await expectRevert(
                this.test.decode(invalidTx),
                'Item must not be a list',
            );
        });

        it('should fail when inputs is not a list', async () => {
            const invalidTx = rlp.encode([
                TX_TYPE.PAYMENT,
                'input0',
                [[OUTPUT_TYPE.PAYMENT, 'Output data']],
                EMPTY_BYTES_32,
            ]);
            await expectRevert(
                this.test.decode(invalidTx),
                'Item is not a list',
            );
        });

        it('should fail when inputs is not a list', async () => {
            const invalidTx = rlp.encode([
                TX_TYPE.PAYMENT,
                ['input0'],
                [OUTPUT_TYPE.PAYMENT, 'Output data'],
                EMPTY_BYTES_32,
            ]);
            await expectRevert(
                this.test.decode(invalidTx),
                'Item is not a list',
            );
        });
    });

    describe('getOutput', async () => {
        it('should return a transaction output', async () => {
            const encoded = rlp.encode([
                TX_TYPE.PAYMENT,
                ['input0', 'input2'],
                [[OUTPUT_TYPE.PAYMENT, 'Output data']],
                EMPTY_BYTES_32,
            ]);

            const output = await this.test.getOutput(encoded, 0);

            expect(new BN(output.outputType)).to.be.bignumber.equal(new BN(OUTPUT_TYPE.PAYMENT));
        });

        it('should fail when output index is out of bounds', async () => {
            const encoded = rlp.encode([
                TX_TYPE.PAYMENT,
                ['input0', 'input2'],
                [[OUTPUT_TYPE.PAYMENT, 'Output data']],
                EMPTY_BYTES_32,
            ]);
            const outOfBoundsOutputIndex = 2;
            await expectRevert(
                this.test.getOutput(encoded, outOfBoundsOutputIndex),
                'Output index out of bound',
            );
        });
    });
});
