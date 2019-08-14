const PaymentOutputToPaymentTxCondition = artifacts.require('PaymentOutputToPaymentTxCondition');

const { constants, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { PaymentTransactionOutput, PaymentTransaction } = require('../../../../helpers/transaction.js');
const { addressToOutputGuard } = require('../../../../helpers/utils.js');
const { hashTx } = require('../../../../helpers/paymentEip712.js');
const { buildUtxoPos } = require('../../../../helpers/positions.js');
const { sign } = require('../../../../helpers/sign.js');

contract('PaymentOutputToPaymentTxCondition', ([richFather]) => {
    const ETH = constants.ZERO_ADDRESS;
    const EMPTY_UTXO_POS = 0;
    const alicePrivateKey = '0x7151e5dab6f8e95b5436515b83f423c4df64fe4c6149f864daa209b26adb10ca';
    const utxoPosToBytes32 = utxoPos => web3.eth.abi.encodeParameter('uint256', utxoPos.toString());
    let alice;

    before('setup alice account with custom private key', async () => {
        const password = 'password1234';
        alice = await web3.eth.personal.importRawKey(alicePrivateKey, password);
        alice = web3.utils.toChecksumAddress(alice);
        web3.eth.personal.unlockAccount(alice, password, 3600);
        web3.eth.sendTransaction({
            to: alice,
            from: richFather,
            value: web3.utils.toWei('1', 'ether'),
        });
    });

    beforeEach('setup contracts', async () => {
        this.dummyFramework = constants.ZERO_ADDRESS;
        this.condition = await PaymentOutputToPaymentTxCondition.new(this.dummyFramework);
    });

    describe('verify', () => {
        it('should fail when spending tx does not match type of payment tx', async () => {
            const outputGuard = addressToOutputGuard(alice);
            const output = new PaymentTransactionOutput(
                1000, outputGuard, ETH,
            );
            const utxoPos = buildUtxoPos(100, 0, 1);
            const inputIndex = 0;
            const wrongTxType = 2;
            const tx = new PaymentTransaction(wrongTxType, [utxoPos], [output]);
            const txBytes = web3.utils.bytesToHex(tx.rlpEncoded());
            await expectRevert(
                this.condition.verify(
                    outputGuard, EMPTY_UTXO_POS, utxoPosToBytes32(utxoPos),
                    txBytes, inputIndex, '0x',
                ),
                'The spending tx is not of payment tx type',
            );
        });

        it('should fail when spending tx does not point to the utxo pos in input', async () => {
            const outputGuard = addressToOutputGuard(alice);
            const output = new PaymentTransactionOutput(
                1000, outputGuard, ETH,
            );
            const utxoPos = buildUtxoPos(100, 0, 1);
            const wrongUtxoPosInTx = utxoPos + 1000;
            const inputIndex = 0;
            const tx = new PaymentTransaction(1, [wrongUtxoPosInTx], [output]);
            const txBytes = web3.utils.bytesToHex(tx.rlpEncoded());
            await expectRevert(
                this.condition.verify(
                    outputGuard, EMPTY_UTXO_POS, utxoPosToBytes32(utxoPos),
                    txBytes, inputIndex, '0x',
                ),
                'The spending tx does not spend the output at this utxo pos',
            );
        });

        it('should fail when spending tx not correctly signed by the input owner', async () => {
            const outputGuard = addressToOutputGuard(alice);
            const output = new PaymentTransactionOutput(
                1000, outputGuard, ETH,
            );
            const utxoPos = buildUtxoPos(100, 0, 1);
            const inputIndex = 0;
            const tx = new PaymentTransaction(1, [utxoPos], [output]);
            const txBytes = web3.utils.bytesToHex(tx.rlpEncoded());
            const txHash = hashTx(tx, this.dummyFramework);
            const wrongPrivateKey = `0x${Array(64).fill(1).join('')}`;
            const wrongSignature = sign(txHash, wrongPrivateKey);
            await expectRevert(
                this.condition.verify(
                    outputGuard, EMPTY_UTXO_POS, utxoPosToBytes32(utxoPos),
                    txBytes, inputIndex, wrongSignature,
                ),
                'Tx not correctly signed',
            );
        });

        it('should return true when all verification passes', async () => {
            const outputGuard = addressToOutputGuard(alice);
            const output = new PaymentTransactionOutput(
                1000, outputGuard, ETH,
            );
            const utxoPos = buildUtxoPos(100, 0, 1);
            const inputIndex = 0;
            const tx = new PaymentTransaction(1, [utxoPos], [output]);
            const txBytes = web3.utils.bytesToHex(tx.rlpEncoded());
            const txHash = hashTx(tx, this.dummyFramework);
            const signature = sign(txHash, alicePrivateKey);

            const result = await this.condition.verify(
                outputGuard, EMPTY_UTXO_POS, utxoPosToBytes32(utxoPos),
                txBytes, inputIndex, signature,
            );
            expect(result).to.be.true;
        });
    });
});
