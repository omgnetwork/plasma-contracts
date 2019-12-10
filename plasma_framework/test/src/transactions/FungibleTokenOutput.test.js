const FungibleTokenOutput = artifacts.require('FungibleTokenOutputWrapper.sol');
const rlp = require('rlp');
const { expect } = require('chai');
const { BN, constants, expectRevert } = require('openzeppelin-test-helpers');
const { FungibleTransactionOutput } = require('../../helpers/transaction.js');
const { EMPTY_BYTES_32, TX_TYPE, OUTPUT_TYPE } = require('../../helpers/constants');

contract('FungibleTokenOutputModel', () => {
    const OUTPUT_GUARD = `0x${Array(40).fill(1).join('')}`;
    const AMOUNT = 100;

    before(async () => {
        this.test = await FungibleTokenOutput.new();
    });

    describe('decodeOutput', async () => {
        it('should return a fungible token output', async () => {
            const expected = new FungibleTransactionOutput(
                OUTPUT_TYPE.PAYMENT,
                AMOUNT,
                OUTPUT_GUARD,
                constants.ZERO_ADDRESS,
            );
            const output = await this.test.decodeOutput(expected.rlpEncoded());

            expect(new BN(output.outputType)).to.be.bignumber.equal(new BN(expected.outputType));
            expect(output.outputGuard).to.equal(expected.outputGuard);
            expect(new BN(output.amount)).to.be.bignumber.equal(new BN(expected.amount));
            expect(output.token).to.equal(expected.token);
        });

        it('should fail when output has not enough items', async () => {
            const invalidOutput = rlp.encode([
                OUTPUT_TYPE.PAYMENT,
                [
                    OUTPUT_GUARD,
                    constants.ZERO_ADDRESS,
                ],
            ]);

            await expectRevert(
                this.test.decodeOutput(invalidOutput),
                'Output data must have 3 items',
            );
        });

        it('should fail when output has too many items', async () => {
            const invalidOutput = rlp.encode([
                OUTPUT_TYPE.PAYMENT,
                [
                    OUTPUT_GUARD,
                    constants.ZERO_ADDRESS,
                    AMOUNT,
                    'Extra data',
                ],
            ]);

            await expectRevert(
                this.test.decodeOutput(invalidOutput),
                'Output data must have 3 items',
            );
        });

        it('should fail when amount is 0', async () => {
            const invalidOutput = rlp.encode([
                OUTPUT_TYPE.PAYMENT,
                [
                    OUTPUT_GUARD,
                    constants.ZERO_ADDRESS,
                    0,
                ],
            ]);

            await expectRevert(
                this.test.decodeOutput(invalidOutput),
                'Output amount must not be 0',
            );
        });

        it('should fail when outputGuard is 0', async () => {
            const invalidOutput = rlp.encode([
                OUTPUT_TYPE.PAYMENT,
                [
                    constants.ZERO_ADDRESS,
                    constants.ZERO_ADDRESS,
                    AMOUNT,
                ],
            ]);

            await expectRevert(
                this.test.decodeOutput(invalidOutput),
                'Output outputGuard must not be 0',
            );
        });
    });

    describe('getOutput', async () => {
        it('should return a transaction output', async () => {
            const expected = new FungibleTransactionOutput(
                OUTPUT_TYPE.PAYMENT,
                AMOUNT,
                OUTPUT_GUARD,
                constants.ZERO_ADDRESS,
            );
            const encoded = rlp.encode([
                TX_TYPE.PAYMENT,
                [],
                [expected.formatForRlpEncoding()],
                EMPTY_BYTES_32,
            ]);

            const output = await this.test.getOutput(encoded, 0);

            expect(new BN(output.outputType)).to.be.bignumber.equal(new BN(expected.outputType));
            expect(output.outputGuard).to.equal(expected.outputGuard);
            expect(new BN(output.amount)).to.be.bignumber.equal(new BN(expected.amount));
            expect(output.token).to.equal(expected.token);
        });

        it('should fail when output index is out of bounds', async () => {
            const encoded = rlp.encode([
                TX_TYPE.PAYMENT,
                [],
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
