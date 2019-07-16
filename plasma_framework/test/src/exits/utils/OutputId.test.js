const OutputId = artifacts.require('OutputIdWrapper');

const { constants } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { PaymentTransaction, PaymentTransactionOutput } = require('../../../helpers/transaction.js');
const { computeDepositOutputId, computeNormalOutputId } = require('../../../helpers/utils.js');

contract('OutputId', () => {
    const OUTPUT_GUARD = `0x${Array(64).fill(1).join('')}`;
    const EMPTY_BYTES32 = `0x${Array(64).fill(0).join('')}`;

    before('setup', async () => {
        this.contract = await OutputId.new();
    });

    describe('compute', () => {
        it('should get the correct output id for deposit tx output', async () => {
            const output = new PaymentTransactionOutput(100, OUTPUT_GUARD, constants.ZERO_ADDRESS);
            const transaction = new PaymentTransaction(1, [EMPTY_BYTES32], [output], EMPTY_BYTES32);
            const dummyTxBytes = web3.utils.bytesToHex(transaction.rlpEncoded());

            const isDeposit = true;
            const outputIndex = 0;
            const dummyUtxoPos = 1000000000;

            expect(await this.contract.compute(isDeposit, dummyTxBytes, outputIndex, dummyUtxoPos))
                .to.equal(computeDepositOutputId(dummyTxBytes, outputIndex, dummyUtxoPos));
        });

        it('should return distinct output ids for deposits that differs in utxo pos', async () => {
            const output = new PaymentTransactionOutput(100, OUTPUT_GUARD, constants.ZERO_ADDRESS);
            const transaction = new PaymentTransaction(1, [EMPTY_BYTES32], [output], EMPTY_BYTES32);
            const dummyTxBytes = web3.utils.bytesToHex(transaction.rlpEncoded());

            const isDeposit = true;
            const outputIndex = 0;
            const dummyUtxoPos1 = 1000000000;
            const dummyUtxoPos2 = 2000000000;

            const outputId1 = await this.contract.compute(isDeposit, dummyTxBytes, outputIndex, dummyUtxoPos1);
            const outputId2 = await this.contract.compute(isDeposit, dummyTxBytes, outputIndex, dummyUtxoPos2);
            expect(outputId1).to.not.equal(outputId2);
        });

        it('should get the correct output id for non deposit tx output when output index is 0', async () => {
            const output = new PaymentTransactionOutput(100, OUTPUT_GUARD, constants.ZERO_ADDRESS);
            const transaction = new PaymentTransaction(1, [1000000000], [output, output], EMPTY_BYTES32);
            const dummyTxBytes = web3.utils.bytesToHex(transaction.rlpEncoded());

            const isDeposit = false;
            const outputIndex = 0;
            const dummyUtxoPos = 123;

            expect(await this.contract.compute(isDeposit, dummyTxBytes, outputIndex, dummyUtxoPos))
                .to.equal(computeNormalOutputId(dummyTxBytes, outputIndex));
        });

        it('should get the correct output id for non deposit tx output when output index is not 0', async () => {
            const output = new PaymentTransactionOutput(100, OUTPUT_GUARD, constants.ZERO_ADDRESS);
            const transaction = new PaymentTransaction(1, [1000000000], [output, output], EMPTY_BYTES32);
            const dummyTxBytes = web3.utils.bytesToHex(transaction.rlpEncoded());

            const isDeposit = false;
            const outputIndex = 1;
            const dummyUtxoPos = 123;

            expect(await this.contract.compute(isDeposit, dummyTxBytes, outputIndex, dummyUtxoPos))
                .to.equal(computeNormalOutputId(dummyTxBytes, outputIndex));
        });

        it('should get the same output id for non deposit tx output no matter what utxo pos is passed in', async () => {
            const output = new PaymentTransactionOutput(100, OUTPUT_GUARD, constants.ZERO_ADDRESS);
            const transaction = new PaymentTransaction(1, [1000000000], [output, output], EMPTY_BYTES32);
            const dummyTxBytes = web3.utils.bytesToHex(transaction.rlpEncoded());

            const isDeposit = false;
            const outputIndex = 1;
            const dummyUtxoPos = 123;
            const randomUtxoPos = 456;

            expect(await this.contract.compute(isDeposit, dummyTxBytes, outputIndex, dummyUtxoPos))
                .to.equal(await this.contract.compute(isDeposit, dummyTxBytes, outputIndex, randomUtxoPos));
        });
    });
});
