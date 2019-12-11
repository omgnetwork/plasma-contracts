const FeeClaimOutputToPaymentTxCondition = artifacts.require('FeeClaimOutputToPaymentTxCondition');

const { constants, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { TX_TYPE, OUTPUT_TYPE } = require('../../../helpers/constants.js');
const { hashTx } = require('../../../helpers/paymentEip712.js');
const { buildUtxoPos, utxoPosToTxPos } = require('../../../helpers/positions.js');
const { sign } = require('../../../helpers/sign.js');
const {
    PaymentTransactionOutput, PaymentTransaction, FeeTransaction, FeeClaimOutput,
} = require('../../../helpers/transaction.js');

contract('FeeClaimOutputToPaymentTxCondition', ([richFather, bob]) => {
    const ETH = constants.ZERO_ADDRESS;
    const DUMMY_BLOCK_NUN = 123;
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
        this.condition = await FeeClaimOutputToPaymentTxCondition.new(
            this.dummyFramework, TX_TYPE.FEE, OUTPUT_TYPE.FEE_CLAIM, TX_TYPE.PAYMENT,
        );
    });

    describe('verify', () => {
        const getTestData = () => {
            const feeOutputs = [
                new FeeClaimOutput(OUTPUT_TYPE.FEE_CLAIM, 1000, alice, ETH),
            ];
            const feeTx = new FeeTransaction(TX_TYPE.FEE, [buildUtxoPos(1000, 0, 0)], feeOutputs, DUMMY_BLOCK_NUN);
            const feeTxBytes = web3.utils.bytesToHex(feeTx.rlpEncoded());

            const feeClaimOutputIndex = 0;
            const utxoPos = buildUtxoPos(2000, 0, feeClaimOutputIndex);
            const feeTxPos = utxoPosToTxPos(utxoPos);


            const paymentOutput = new PaymentTransactionOutput(
                OUTPUT_TYPE.PAYMENT, 1000, bob, ETH,
            );
            const paymentTx = new PaymentTransaction(TX_TYPE.PAYMENT, [utxoPos], [paymentOutput]);
            const paymentTxBytes = web3.utils.bytesToHex(paymentTx.rlpEncoded());
            const inputIndex = 0;
            const txHash = hashTx(paymentTx, this.dummyFramework);
            const signature = sign(txHash, alicePrivateKey);

            const args = {
                feeTxBytes,
                feeClaimOutputIndex,
                feeTxPos,
                paymentTxBytes,
                inputIndex,
                signature,
            };

            return {
                args,
                paymentTx,
            };
        };

        it('should fail when fee claim output index is not 0', async () => {
            const { args } = getTestData();

            await expectRevert(
                this.condition.verify(
                    args.feeTxBytes,
                    1,
                    args.feeTxPos,
                    args.paymentTxBytes,
                    args.inputIndex,
                    args.signature,
                ),
                'Fee claim output must be the first output of fee tx',
            );
        });

        it('should fail when fee tx is not with the expected tx type', async () => {
            const { args } = getTestData();
            const mismatchFeeTxType = 999;
            const conditionWithDifferentTxType = await FeeClaimOutputToPaymentTxCondition.new(
                this.dummyFramework, mismatchFeeTxType, OUTPUT_TYPE.FEE_CLAIM, TX_TYPE.PAYMENT,
            );

            await expectRevert(
                conditionWithDifferentTxType.verify(
                    args.feeTxBytes,
                    args.feeClaimOutputIndex,
                    args.feeTxPos,
                    args.paymentTxBytes,
                    args.inputIndex,
                    args.signature,
                ),
                'Unexpected tx type for fee transaction',
            );
        });

        it('should fail when fee claim output is not with the expected output type', async () => {
            const { args } = getTestData();
            const mismatchFeeClaimOutputType = 999;
            const conditionWithDifferentTxType = await FeeClaimOutputToPaymentTxCondition.new(
                this.dummyFramework, TX_TYPE.FEE, mismatchFeeClaimOutputType, TX_TYPE.PAYMENT,
            );

            await expectRevert(
                conditionWithDifferentTxType.verify(
                    args.feeTxBytes,
                    args.feeClaimOutputIndex,
                    args.feeTxPos,
                    args.paymentTxBytes,
                    args.inputIndex,
                    args.signature,
                ),
                'Unexpected output type for fee claim output',
            );
        });

        it('should fail when payment tx is not with the expected tx type', async () => {
            const { args } = getTestData();
            const mismatchPaymentTxType = 999;
            const conditionWithDifferentTxType = await FeeClaimOutputToPaymentTxCondition.new(
                this.dummyFramework, TX_TYPE.FEE, OUTPUT_TYPE.FEE_CLAIM, mismatchPaymentTxType,
            );

            await expectRevert(
                conditionWithDifferentTxType.verify(
                    args.feeTxBytes,
                    args.feeClaimOutputIndex,
                    args.feeTxPos,
                    args.paymentTxBytes,
                    args.inputIndex,
                    args.signature,
                ),
                'Unexpected tx type for payment transaction',
            );
        });

        it('should fail when payment tx does not point to the fee claim output', async () => {
            const { args } = getTestData();
            const wrongUtxoPos = buildUtxoPos(9999, 999, 999);
            const wrongTxPos = utxoPosToTxPos(wrongUtxoPos);

            await expectRevert(
                this.condition.verify(
                    args.feeTxBytes,
                    args.feeClaimOutputIndex,
                    wrongTxPos,
                    args.paymentTxBytes,
                    args.inputIndex,
                    args.signature,
                ),
                'Payment tx points to the incorrect output UTXO position of the fee claim output',
            );
        });

        it('should fail when failed to recover the signer from the signature', async () => {
            const { args } = getTestData();

            const wrongSignature = args.signature.substring(0, args.signature.length - 1).concat('f');

            await expectRevert(
                this.condition.verify(
                    args.feeTxBytes,
                    args.feeClaimOutputIndex,
                    args.feeTxPos,
                    args.paymentTxBytes,
                    args.inputIndex,
                    wrongSignature,
                ),
                'Failed to recover the signer from the signature',
            );
        });

        it('should fail when payment tx not correctly signed by the fee claim output owner', async () => {
            const { args, paymentTx } = getTestData();

            const txHash = hashTx(paymentTx, this.dummyFramework);
            const wrongPrivateKey = `0x${Array(64).fill(1).join('')}`;
            const wrongSignature = sign(txHash, wrongPrivateKey);

            await expectRevert(
                this.condition.verify(
                    args.feeTxBytes,
                    args.feeClaimOutputIndex,
                    args.feeTxPos,
                    args.paymentTxBytes,
                    args.inputIndex,
                    wrongSignature,
                ),
                'Tx is not signed correctly',
            );
        });

        it('should return true when all verification passes', async () => {
            const { args } = getTestData();

            const result = await this.condition.verify(
                args.feeTxBytes,
                args.feeClaimOutputIndex,
                args.feeTxPos,
                args.paymentTxBytes,
                args.inputIndex,
                args.signature,
            );
            expect(result).to.be.true;
        });
    });
});
