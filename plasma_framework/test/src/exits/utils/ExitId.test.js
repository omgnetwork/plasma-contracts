const ExitId = artifacts.require('ExitIdWrapper');

const { BN, constants, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { PaymentTransaction, PaymentTransactionOutput } = require('../../../helpers/transaction.js');
const { OUTPUT_TYPE } = require('../../../helpers/constants.js');

contract('ExitId', () => {
    const OUTPUT_GUARD = `0x${Array(64).fill(1).join('')}`;
    const EMPTY_BYTES32 = `0x${Array(64).fill(0).join('')}`;
    const DUMMY_INPUT = '0x000000000000000000000000000000000000000000000000000000003b9aca00';

    before('setup', async () => {
        this.contract = await ExitId.new();
    });

    describe('isStandardExit', () => {
        it('should return true given a standard exit id for deposit tx', async () => {
            const isDeposit = true;
            const dummyTxBytes = `0x${Array(100).fill(1).join('')}`;
            const dummyUtxoPos = 1000000000;

            const exitId = await this.contract.getStandardExitId(isDeposit, dummyTxBytes, dummyUtxoPos);
            expect(await this.contract.isStandardExit(exitId)).to.be.true;
        });

        it('should return true given a standard exit id for non deposit tx', async () => {
            const isDeposit = false;
            const dummyTxBytes = `0x${Array(100).fill(1).join('')}`;
            const dummyUtxoPos = 1000000000;

            const exitId = await this.contract.getStandardExitId(isDeposit, dummyTxBytes, dummyUtxoPos);
            expect(await this.contract.isStandardExit(exitId)).to.be.true;
        });

        it('should return false given an in-flight exit id', async () => {
            const dummyTxBytes = `0x${Array(100).fill(1).join('')}`;
            const exitId = await this.contract.getInFlightExitId(dummyTxBytes);
            expect(await this.contract.isStandardExit(exitId)).to.be.false;
        });
    });

    describe('getStandardExitId', () => {
        it('should get the correct exit id for deposit tx output', async () => {
            const output = new PaymentTransactionOutput(OUTPUT_TYPE.PAYMENT, 100, OUTPUT_GUARD, constants.ZERO_ADDRESS);
            const transaction = new PaymentTransaction(1, [EMPTY_BYTES32], [output], EMPTY_BYTES32);
            const dummyTxBytes = web3.utils.bytesToHex(transaction.rlpEncoded());

            const isDeposit = true;
            const dummyUtxoPos = 1000000000;

            expect(await this.contract.getStandardExitId(isDeposit, dummyTxBytes, dummyUtxoPos))
                .to.be.bignumber.equal(new BN('171604140400374077931245824211501905564658753222974'));
        });

        it('should return distinct exit ids for deposits that differ only in utxo pos', async () => {
            const output = new PaymentTransactionOutput(OUTPUT_TYPE.PAYMENT, 100, OUTPUT_GUARD, constants.ZERO_ADDRESS);
            const transaction = new PaymentTransaction(1, [EMPTY_BYTES32], [output], EMPTY_BYTES32);
            const dummyTxBytes = web3.utils.bytesToHex(transaction.rlpEncoded());

            const isDeposit = true;
            const dummyUtxoPos1 = 1000000000;
            const dummyUtxoPos2 = 2000000000;

            const exitId1 = await this.contract.getStandardExitId(isDeposit, dummyTxBytes, dummyUtxoPos1);
            const exitId2 = await this.contract.getStandardExitId(isDeposit, dummyTxBytes, dummyUtxoPos2);
            expect(exitId1).to.not.equal(exitId2);
        });

        it('should get the correct exit id for non deposit tx output', async () => {
            const output = new PaymentTransactionOutput(OUTPUT_TYPE.PAYMENT, 100, OUTPUT_GUARD, constants.ZERO_ADDRESS);
            const transaction = new PaymentTransaction(1, [DUMMY_INPUT], [output], EMPTY_BYTES32);
            const dummyTxBytes = web3.utils.bytesToHex(transaction.rlpEncoded());

            const isDeposit = false;
            const dummyUtxoPos = 123;
            expect(await this.contract.getStandardExitId(isDeposit, dummyTxBytes, dummyUtxoPos))
                .to.be.bignumber.equal(new BN('172275862235925986801710974270448919124838083678'));
        });
    });

    describe('getInFlightExitId', () => {
        before(async () => {
            const output = new PaymentTransactionOutput(OUTPUT_TYPE.PAYMENT, 100, OUTPUT_GUARD, constants.ZERO_ADDRESS);
            const transaction = new PaymentTransaction(1, [DUMMY_INPUT], [output], EMPTY_BYTES32);
            this.transactionBytes = web3.utils.bytesToHex(transaction.rlpEncoded());
        });

        it('should get correct in-flight exit id', async () => {
            expect(await this.contract.getInFlightExitId(this.transactionBytes))
                .to.be.bignumber.equal(new BN('187244485440591499516873369561954675435084203584606'));
        });

        it('should get an exit id that differs from standard exit id', async () => {
            const dummyUtxoPos = 1000000000;
            const seId = await this.contract.getStandardExitId(false, this.transactionBytes, dummyUtxoPos);
            const ifeId = await this.contract.getInFlightExitId(this.transactionBytes);

            expect(seId).to.be.bignumber.not.equal(ifeId);
        });
    });
});
