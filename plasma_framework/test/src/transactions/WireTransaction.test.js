const rlp = require('rlp');
const { expect } = require('chai');
const { BN, constants } = require('openzeppelin-test-helpers');

const { PaymentTransaction, PaymentTransactionOutput } = require('../../helpers/transaction.js');

const WireTransaction = artifacts.require('WireTransactionWrapper.sol');

const OUTPUT_GUARD = `0x${Array(64).fill(1).join('')}`;
const EMPTY_BYTES32 = `0x${Array(64).fill(0).join('')}`;
const AMOUNT = 100;

contract('WireTransaction', () => {
    before(async () => {
        this.test = await WireTransaction.new();
    });

    it('should decode payment transaction output', async () => {
        const output = new PaymentTransactionOutput(AMOUNT, OUTPUT_GUARD, constants.ZERO_ADDRESS);
        const transaction = new PaymentTransaction(1, [EMPTY_BYTES32], [output, output], EMPTY_BYTES32);
        const encoded = web3.utils.bytesToHex(transaction.rlpEncoded());

        const actual = await this.test.getOutput(encoded, 0);

        expect(actual.outputGuard).to.equal(OUTPUT_GUARD);
        expect(new BN(actual.amount)).to.be.bignumber.equal(new BN(AMOUNT));
        expect(actual.token).to.equal(constants.ZERO_ADDRESS);
    });

    it('should decode custom transaction output', async () => {
        const encoded = rlp.encode([0, [], [[AMOUNT, OUTPUT_GUARD, constants.ZERO_ADDRESS]], EMPTY_BYTES32, []]);

        const actual = await this.test.getOutput(encoded, 0);

        expect(actual.outputGuard).to.equal(OUTPUT_GUARD);
        expect(new BN(actual.amount)).to.be.bignumber.equal(new BN(AMOUNT));
        expect(actual.token).to.equal(constants.ZERO_ADDRESS);
    });
});
