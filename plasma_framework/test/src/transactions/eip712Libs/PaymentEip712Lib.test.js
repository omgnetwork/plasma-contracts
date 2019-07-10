const PaymentEip712Lib = artifacts.require('PaymentEip712LibMock');

const { expect } = require('chai');
const { constants } = require('openzeppelin-test-helpers');
const {
    PaymentTransactionOutput, PaymentTransaction, PlasmaDepositTransaction,
} = require('../../../helpers/transaction.js');
const { addressToOutputGuard } = require('../../../helpers/utils.js');
const { buildUtxoPos } = require('../../../helpers/utxoPos.js');
const { hashTx } = require('../../../helpers/paymentEip712.js');

const OUTPUT_GUARD = `0x${Array(64).fill(1).join('')}`;

contract('PaymentEip712Lib', ([alice]) => {
    before(async () => {
        this.verifyingContract = (await PaymentEip712Lib.new(constants.ZERO_ADDRESS)).address;
        this.contract = await PaymentEip712Lib.new(this.verifyingContract);
    });

    describe('hashTx', () => {
        it('should hash normal transaction correctly', async () => {
            const metaData = `0x${Array(64).fill(2).join('')}`;
            const output = new PaymentTransactionOutput(100, OUTPUT_GUARD, constants.ZERO_ADDRESS);
            const utxoPos = buildUtxoPos(10000, 0, 0);
            const tx = new PaymentTransaction(1, [utxoPos], [output], metaData);
            const txBytes = web3.utils.bytesToHex(tx.rlpEncoded());

            expect(await this.contract.hashTx(this.verifyingContract, txBytes))
                .to.equal(hashTx(tx, this.verifyingContract));
        });

        it('should hash deposit transaction correctly', async () => {
            const output = new PaymentTransactionOutput(
                100, addressToOutputGuard(alice), constants.ZERO_ADDRESS,
            );
            const tx = new PlasmaDepositTransaction(output);
            const txBytes = web3.utils.bytesToHex(tx.rlpEncoded());

            expect(await this.contract.hashTx(this.verifyingContract, txBytes))
                .to.equal(hashTx(tx, this.verifyingContract));
        });

        it('should hash transaction correctly given transaction has empty metaData', async () => {
            const output = new PaymentTransactionOutput(100, OUTPUT_GUARD, constants.ZERO_ADDRESS);
            const utxoPos = buildUtxoPos(10000, 0, 0);
            const tx = new PaymentTransaction(1, [utxoPos], [output]);
            const txBytes = web3.utils.bytesToHex(tx.rlpEncoded());

            expect(await this.contract.hashTx(this.verifyingContract, txBytes))
                .to.equal(hashTx(tx, this.verifyingContract));
        });
    });
});
