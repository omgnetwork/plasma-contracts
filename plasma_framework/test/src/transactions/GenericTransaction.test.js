const GenericTransaction = artifacts.require('GenericTransactionWrapper.sol');
const rlp = require('rlp');
const { expect } = require('chai');
const { BN, expectRevert } = require('openzeppelin-test-helpers');

contract('GenericTransaction', () => {
    const EMPTY_BYTES32 = `0x${Array(64).fill(0).join('')}`;
    const TX_TYPE = 1;
    const OUTPUT_TYPE = 1;

    before(async () => {
        this.test = await GenericTransaction.new();
    });

    describe('decode', async () => {
        it('should decode a correctly formatted transaction', async () => {
            const encoded = rlp.encode([
                TX_TYPE,
                ['input0', 'input2'],
                [[OUTPUT_TYPE, 'Output data']],
                EMPTY_BYTES32,
            ]);

            const decoded = await this.test.decode(encoded);
            expect(new BN(decoded.txType)).to.be.bignumber.equal(new BN(TX_TYPE));
        });

        it('should fail when not enough items', async () => {
            const invalidTx = rlp.encode([
                TX_TYPE,
                ['input0', 'input2'],
                [[OUTPUT_TYPE, 'Output data']],
            ]);
            await expectRevert(
                this.test.decode(invalidTx),
                'Invalid encoding of transaction',
            );
        });

        it('should fail when too many items', async () => {
            const invalidTx = rlp.encode([
                TX_TYPE,
                ['input0', 'input2'],
                [[OUTPUT_TYPE, 'Output data']],
                EMPTY_BYTES32,
                'Extra item',
            ]);
            await expectRevert(
                this.test.decode(invalidTx),
                'Invalid encoding of transaction',
            );
        });

        it('should fail when type is 0', async () => {
            const invalidTx = rlp.encode([
                0,
                ['input0', 'input2'],
                [[OUTPUT_TYPE, 'Output data']],
                EMPTY_BYTES32,
            ]);
            await expectRevert(
                this.test.decode(invalidTx),
                'Transaction type must not be 0',
            );
        });

        it('should fail when output type is 0', async () => {
            const invalidTx = rlp.encode([
                TX_TYPE,
                ['input0', 'input2'],
                [[0, 'Output data']],
                EMPTY_BYTES32,
            ]);
            await expectRevert(
                this.test.decode(invalidTx),
                'Output type must not be 0',
            );
        });

        it('should fail when not enough items in output', async () => {
            const invalidTx = rlp.encode([
                TX_TYPE,
                ['input0', 'input2'],
                [[OUTPUT_TYPE]],
                EMPTY_BYTES32,
            ]);
            await expectRevert(
                this.test.decode(invalidTx),
                'Output must have 2 items',
            );
        });

        it('should fail when too many items in output', async () => {
            const invalidTx = rlp.encode([
                TX_TYPE,
                ['input0', 'input2'],
                [[OUTPUT_TYPE, 'Output data', 'More Output data']],
                EMPTY_BYTES32,
            ]);
            await expectRevert(
                this.test.decode(invalidTx),
                'Output must have 2 items',
            );
        });
    });

    describe('getOutput', async () => {
        it('should return a transaction output', async () => {
            const encoded = rlp.encode([
                TX_TYPE,
                ['input0', 'input2'],
                [[OUTPUT_TYPE, 'Output data']],
                EMPTY_BYTES32,
            ]);

            const output = await this.test.getOutput(encoded, 0);

            expect(new BN(output.outputType)).to.be.bignumber.equal(new BN(OUTPUT_TYPE));
        });

        it('should fail when output index is out of bounds', async () => {
            const encoded = rlp.encode([
                TX_TYPE,
                ['input0', 'input2'],
                [[OUTPUT_TYPE, 'Output data']],
                EMPTY_BYTES32,
            ]);
            const outOfBoundsOutputIndex = 2;
            await expectRevert(
                this.test.getOutput(encoded, outOfBoundsOutputIndex),
                'Output index out of bound',
            );
        });
    });
});
