const PaymentOutputToPaymentTxCondition = artifacts.require('PaymentOutputToPaymentTxCondition');

const { constants, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { EMPTY_BYTES, OUTPUT_TYPE } = require('../../../../helpers/constants.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../../../../helpers/transaction.js');
const { hashTx } = require('../../../../helpers/paymentEip712.js');
const { buildUtxoPos, utxoPosToTxPos } = require('../../../../helpers/positions.js');
const { sign } = require('../../../../helpers/sign.js');

contract('PaymentOutputToPaymentTxCondition', ([richFather, bob]) => {
    const TEST_INPUT_TX_TYPE = 1;
    const TEST_SPENDING_TX_TYPE = 2;
    const ETH = constants.ZERO_ADDRESS;
    const alicePrivateKey = '0x7151e5dab6f8e95b5436515b83f423c4df64fe4c6149f864daa209b26adb10ca';
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
        this.condition = await PaymentOutputToPaymentTxCondition.new(
            this.dummyFramework, TEST_INPUT_TX_TYPE, TEST_SPENDING_TX_TYPE,
        );
    });

    describe('verify', () => {
        const getTestData = () => {
            const aliceOutputGuard = alice;
            const outputInInputTx = new PaymentTransactionOutput(
                OUTPUT_TYPE.PAYMENT, 1000, aliceOutputGuard, ETH,
            );
            const inputTx = new PaymentTransaction(TEST_INPUT_TX_TYPE, [buildUtxoPos(1000, 0, 0)], [outputInInputTx]);
            const inputTxBytes = web3.utils.bytesToHex(inputTx.rlpEncoded());
            const outputIndex = 0;

            const utxoPos = buildUtxoPos(2000, 0, outputIndex);
            const inputTxPos = utxoPosToTxPos(utxoPos);

            const bobOutputGuard = bob;
            const outputInSpendingTx = new PaymentTransactionOutput(
                OUTPUT_TYPE.PAYMENT, 1000, bobOutputGuard, ETH,
            );

            const spendingTx = new PaymentTransaction(TEST_SPENDING_TX_TYPE, [utxoPos], [outputInSpendingTx]);
            const inputIndex = 0;
            const spendingTxBytes = web3.utils.bytesToHex(spendingTx.rlpEncoded());
            const txHash = hashTx(spendingTx, this.dummyFramework);
            const signature = sign(txHash, alicePrivateKey);

            const args = {
                inputTxBytes,
                outputIndex,
                inputTxPos,
                spendingTxBytes,
                inputIndex,
                signature,
            };

            return {
                args,
                spendingTx,
            };
        };

        it('should fail when input tx does not match the supported type of payment tx', async () => {
            const { args } = getTestData();
            const newSupportedInputTxType = 999;
            const conditionWithDifferentTxType = await PaymentOutputToPaymentTxCondition.new(
                this.dummyFramework, newSupportedInputTxType, TEST_SPENDING_TX_TYPE,
            );

            await expectRevert(
                conditionWithDifferentTxType.verify(
                    args.inputTxBytes,
                    args.outputIndex,
                    args.inputTxPos,
                    args.spendingTxBytes,
                    args.inputIndex,
                    args.signature,
                ),
                'Input tx is an unsupported payment tx type',
            );
        });

        it('should fail when spending tx does not match the supported type of payment tx', async () => {
            const { args } = getTestData();
            const newSupportedSpendingTxType = 999;
            const conditionWithDifferentTxType = await PaymentOutputToPaymentTxCondition.new(
                this.dummyFramework, TEST_INPUT_TX_TYPE, newSupportedSpendingTxType,
            );

            await expectRevert(
                conditionWithDifferentTxType.verify(
                    args.inputTxBytes,
                    args.outputIndex,
                    args.inputTxPos,
                    args.spendingTxBytes,
                    args.inputIndex,
                    args.signature,
                ),
                'The spending tx is an unsupported payment tx type',
            );
        });

        it('should fail when spending tx does not point to the utxo pos in input', async () => {
            const { args } = getTestData();
            const wrongUtxoPos = buildUtxoPos(9999, 999, 999);
            const wrongTxPos = utxoPosToTxPos(wrongUtxoPos);

            await expectRevert(
                this.condition.verify(
                    args.inputTxBytes,
                    args.outputIndex,
                    wrongTxPos,
                    args.spendingTxBytes,
                    args.inputIndex,
                    args.signature,
                ),
                'Spending tx points to the incorrect output UTXO position',
            );
        });

        it('should fail when failed to recover the signer from the signature', async () => {
            const { args } = getTestData();

            const wrongSignature = args.signature.substring(0, args.signature.length - 1).concat('f');

            await expectRevert(
                this.condition.verify(
                    args.inputTxBytes,
                    args.outputIndex,
                    args.inputTxPos,
                    args.spendingTxBytes,
                    args.inputIndex,
                    wrongSignature,
                ),
                'Failed to recover the signer from the signature',
            );
        });

        it('should fail when spending tx not correctly signed by the input owner', async () => {
            const { args, spendingTx } = getTestData();

            const txHash = hashTx(spendingTx, this.dummyFramework);
            const wrongPrivateKey = `0x${Array(64).fill(1).join('')}`;
            const wrongSignature = sign(txHash, wrongPrivateKey);

            await expectRevert(
                this.condition.verify(
                    args.inputTxBytes,
                    args.outputIndex,
                    args.inputTxPos,
                    args.spendingTxBytes,
                    args.inputIndex,
                    wrongSignature,
                ),
                'Tx is not signed correctly',
            );
        });

        it('should return true when all verification passes', async () => {
            const { args } = getTestData();

            const result = await this.condition.verify(
                args.inputTxBytes,
                args.outputIndex,
                args.inputTxPos,
                args.spendingTxBytes,
                args.inputIndex,
                args.signature,
            );
            expect(result).to.be.true;
        });
    });
});
