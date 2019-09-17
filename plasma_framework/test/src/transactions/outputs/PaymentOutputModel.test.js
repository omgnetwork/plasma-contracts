const rlp = require('rlp');
const { expect } = require('chai');
const { constants, expectRevert } = require('openzeppelin-test-helpers');
const { PaymentTransactionOutput } = require('../../../helpers/transaction.js');

const PaymentOutputModelMock = artifacts.require('PaymentOutputModelMock');

const OUTPUT_GUARD = `0x${Array(40).fill(1).join('')}`;

contract('PaymentOutputModel', ([alice]) => {
    before(async () => {
        this.test = await PaymentOutputModelMock.new();
    });

    describe('decode', () => {
        it('should decode output', async () => {
            const expected = new PaymentTransactionOutput(100, OUTPUT_GUARD, constants.ZERO_ADDRESS);
            const encoded = web3.utils.bytesToHex(rlp.encode(expected.formatForRlpEncoding()));

            const output = await this.test.decode(encoded);
            const actual = PaymentTransactionOutput.parseFromContractOutput(output);

            expect(JSON.stringify(actual)).to.equal(JSON.stringify(expected));
        });

        it('should fail when decoding invalid output', async () => {
            const encoded = web3.utils.bytesToHex(rlp.encode([0, 0, 0, 0]));
            await expectRevert(this.test.decode(encoded), 'Invalid output encoding');
        });
    });

    describe('owner', () => {
        it('should parse the owner address from output guard when output guard holds the owner info directly', async () => {
            expect(await this.test.owner(100, alice, constants.ZERO_ADDRESS)).to.equal(alice);
        });
    });
});
