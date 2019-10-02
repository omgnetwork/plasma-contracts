const PaymentTransactionStateTransitionVerifier = artifacts.require('PaymentTransactionStateTransitionVerifier');

const { BN, constants, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { buildUtxoPos, UtxoPos } = require('../../../helpers/positions.js');
const { computeNormalOutputId } = require('../../../helpers/utils.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../../../helpers/transaction.js');
const { OUTPUT_TYPE } = require('../../../helpers/constants.js');

contract('PaymentTransactionStateTransitionVerifier', ([alice, bob]) => {
    const ETH = constants.ZERO_ADDRESS;
    const IFE_TX_TYPE = 1;
    const DUMMY_INPUT_1 = '0x0000000000000000000000000000000000000000000000000000000000000001';
    const DUMMY_INPUT_2 = '0x0000000000000000000000000000000000000000000000000000000000000002';
    const OTHER_TOKEN = '0x0000000000000000000000000000000000000001';
    const BLOCK_NUM = 1000;
    const AMOUNT = 100;


    describe('verifies state transition', () => {
        before(async () => {
            this.verifier = await PaymentTransactionStateTransitionVerifier.new();
        });

        function buildCorrectStateTransitionArgs() {
            const inputTx1 = createInputTransaction(DUMMY_INPUT_1, alice, AMOUNT);
            const inputTx2 = createInputTransaction(DUMMY_INPUT_2, alice, AMOUNT);
            const inputTxs = [inputTx1, inputTx2];

            const inputUtxosPos = [buildUtxoPos(BLOCK_NUM, 0, 0), buildUtxoPos(BLOCK_NUM, 1, 0)];
            const outputIndexOfInputTxs = inputUtxosPos.map(utxo => new UtxoPos(utxo).outputIndex);

            const inFlightTx = createInFlightTx(inputTxs, inputUtxosPos, bob, AMOUNT);
            const args = buildArgs(inputTxs, outputIndexOfInputTxs, inFlightTx);

            return args;
        }

        function buildInvalidStateTransitionArgs(invalidAmount) {
            const inputTx1 = createInputTransaction(DUMMY_INPUT_1, alice, AMOUNT);
            const inputTx2 = createInputTransaction(DUMMY_INPUT_2, bob, AMOUNT, OTHER_TOKEN);

            const inputUtxosPos = [buildUtxoPos(BLOCK_NUM, 0, 0), buildUtxoPos(BLOCK_NUM, 1, 0)];
            const inputs = createInputsForInFlightTx([inputTx1, inputTx2], inputUtxosPos);

            const output1 = new PaymentTransactionOutput(OUTPUT_TYPE.PAYMENT, invalidAmount, alice, ETH);
            const output2 = new PaymentTransactionOutput(OUTPUT_TYPE.PAYMENT, invalidAmount, bob, ETH);

            const inFlightTx = new PaymentTransaction(IFE_TX_TYPE, inputs, [output1, output2]);
            const outputIndexOfInputTxs = inputUtxosPos.map(utxo => new UtxoPos(utxo).outputIndex);
            const args = buildArgs([inputTx1, inputTx2], outputIndexOfInputTxs, inFlightTx);

            return args;
        }

        function buildArgs([inputTx1, inputTx2], outputIndexOfInputTxs, inFlightTx) {
            const rlpInputTx1 = inputTx1.rlpEncoded();
            const encodedInputTx1 = web3.utils.bytesToHex(rlpInputTx1);

            const rlpInputTx2 = inputTx2.rlpEncoded();
            const encodedInputTx2 = web3.utils.bytesToHex(rlpInputTx2);

            const inputTxs = [encodedInputTx1, encodedInputTx2];

            const inFlightTxRaw = web3.utils.bytesToHex(inFlightTx.rlpEncoded());

            const args = {
                inFlightTx: inFlightTxRaw,
                inputTxs,
                outputIndexOfInputTxs,
            };

            return args;
        }

        function createInputTransaction(input, owner, amount, token = ETH) {
            const output = new PaymentTransactionOutput(OUTPUT_TYPE.PAYMENT, amount, owner, token);
            return new PaymentTransaction(IFE_TX_TYPE, [input], [output]);
        }

        function createInFlightTx(inputTxs, inputUtxosPos, ifeOwner, amount, token = ETH) {
            const inputs = createInputsForInFlightTx(inputTxs, inputUtxosPos);

            const output = new PaymentTransactionOutput(
                OUTPUT_TYPE.PAYMENT,
                amount * inputTxs.length,
                ifeOwner,
                token,
            );

            return new PaymentTransaction(1, inputs, [output]);
        }

        function createInputsForInFlightTx(inputTxs, inputUtxosPos) {
            const inputs = [];
            for (let i = 0; i < inputTxs.length; i++) {
                const inputUtxoPos = new UtxoPos(inputUtxosPos[i]);
                const inputTx = web3.utils.bytesToHex(inputTxs[i].rlpEncoded());
                const outputId = computeNormalOutputId(inputTx, inputUtxoPos.outputIndex);
                inputs.push(outputId);
            }
            return inputs;
        }

        it('should return true for a valid state transition', async () => {
            const args = buildCorrectStateTransitionArgs();
            const verificationResult = await this.verifier.isCorrectStateTransition(
                args.inFlightTx,
                args.inputTxs,
                args.outputIndexOfInputTxs,
            );
            expect(verificationResult).to.be.true;
        });

        it('should return false when in-flight transaction overspends', async () => {
            const args = buildInvalidStateTransitionArgs(AMOUNT + 1);

            const verificationResult = await this.verifier.isCorrectStateTransition(
                args.inFlightTx,
                args.inputTxs,
                args.outputIndexOfInputTxs,
            );
            expect(verificationResult).to.be.false;
        });

        it('should return false when input transactions list and utxos positions differ in length', async () => {
            const args = buildCorrectStateTransitionArgs();
            const verificationResult = await this.verifier.isCorrectStateTransition(
                args.inFlightTx,
                args.inputTxs,
                [],
            );
            expect(verificationResult).to.be.false;
        });

        it('should revert when sum of outputs overflows uint256', async () => {
            const amount = (new BN(2)).pow(new BN(255));
            const args = buildInvalidStateTransitionArgs(amount);

            await expectRevert(
                this.verifier.isCorrectStateTransition(
                    args.inFlightTx,
                    args.inputTxs,
                    args.outputIndexOfInputTxs,
                ),
                'SafeMath: addition overflow',
            );
        });
    });
});
