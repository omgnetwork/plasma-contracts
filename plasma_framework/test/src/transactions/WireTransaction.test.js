const rlp = require('rlp');
const { expect } = require('chai');
const { BN, constants, expectRevert } = require('openzeppelin-test-helpers');

const { PaymentTransaction, PaymentTransactionOutput } = require('../../helpers/transaction.js');

const WireTransaction = artifacts.require('WireTransactionWrapper.sol');

contract('WireTransaction', () => {
    const OUTPUT_GUARD = `0x${Array(40).fill(1).join('')}`;
    const EMPTY_BYTES32 = `0x${Array(64).fill(0).join('')}`;
    const AMOUNT = 100;
    const TX_TYPE = 1;
    const OUTPUT_TYPE = 1;

    before(async () => {
        this.test = await WireTransaction.new();
        const output = new PaymentTransactionOutput(OUTPUT_TYPE, AMOUNT, OUTPUT_GUARD, constants.ZERO_ADDRESS);
        const transaction = new PaymentTransaction(TX_TYPE, [EMPTY_BYTES32], [output, output], EMPTY_BYTES32);
        this.paymentTransaction = web3.utils.bytesToHex(transaction.rlpEncoded());
    });

    describe('getOutput', async () => {
        it('should decode payment transaction output', async () => {
            const actual = await this.test.getOutput(this.paymentTransaction, 0);

            expect(new BN(actual.outputType)).to.be.bignumber.equal(new BN(OUTPUT_TYPE));
            expect(actual.outputGuard).to.equal(OUTPUT_GUARD);
            expect(new BN(actual.amount)).to.be.bignumber.equal(new BN(AMOUNT));
            expect(actual.token).to.equal(constants.ZERO_ADDRESS);
        });

        it('should decode custom transaction output that fulfills wire transaction format', async () => {
            const encoded = rlp.encode([
                0,
                [],
                [[OUTPUT_TYPE, OUTPUT_GUARD, constants.ZERO_ADDRESS, AMOUNT]],
                EMPTY_BYTES32,
                [],
            ]);
            const actual = await this.test.getOutput(encoded, 0);

            expect(new BN(actual.outputType)).to.be.bignumber.equal(new BN(OUTPUT_TYPE));
            expect(actual.outputGuard).to.equal(OUTPUT_GUARD);
            expect(new BN(actual.amount)).to.be.bignumber.equal(new BN(AMOUNT));
            expect(actual.token).to.equal(constants.ZERO_ADDRESS);
        });

        it('should fail when output index is out of bounds', async () => {
            const outOfBoundsOutputIndex = 2;
            await expectRevert(
                this.test.getOutput(this.paymentTransaction, outOfBoundsOutputIndex),
                'Output index out of bound',
            );
        });
    });

    describe('getTransactionType', async () => {
        it('should decode payment transaction type', async () => {
            const actual = await this.test.getTransactionType(this.paymentTransaction);
            expect(new BN(actual)).to.be.bignumber.equal(new BN(TX_TYPE));
        });

        it('should decode type of custom transaction that fulfills wire transaction format', async () => {
            const encoded = web3.utils.bytesToHex(
                rlp.encode([0, [], [[OUTPUT_TYPE, AMOUNT, OUTPUT_GUARD, constants.ZERO_ADDRESS]], EMPTY_BYTES32, []]),
            );
            const actual = await this.test.getTransactionType(encoded);
            expect(new BN(actual)).to.be.bignumber.equal(new BN(0));
        });
    });
});
