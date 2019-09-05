const ExitId = artifacts.require('ExitIdWrapper');

const { BN, constants } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { PaymentTransaction, PaymentTransactionOutput } = require('../../../helpers/transaction.js');

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
            const output = new PaymentTransactionOutput(100, OUTPUT_GUARD, constants.ZERO_ADDRESS);
            const transaction = new PaymentTransaction(1, [EMPTY_BYTES32], [output], EMPTY_BYTES32);
            const dummyTxBytes = web3.utils.bytesToHex(transaction.rlpEncoded());

            const isDeposit = true;
            const dummyUtxoPos = 1000000000;

            expect(await this.contract.getStandardExitId(isDeposit, dummyTxBytes, dummyUtxoPos))
                .to.be.bignumber.equal(new BN('875820471800989289891627481718386259727369323'));
        });

        it('should return distinct exit ids for deposits that differ only in utxo pos', async () => {
            const output = new PaymentTransactionOutput(100, OUTPUT_GUARD, constants.ZERO_ADDRESS);
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
            const output = new PaymentTransactionOutput(100, OUTPUT_GUARD, constants.ZERO_ADDRESS);
            const transaction = new PaymentTransaction(1, [DUMMY_INPUT], [output], EMPTY_BYTES32);
            const dummyTxBytes = web3.utils.bytesToHex(transaction.rlpEncoded());

            const isDeposit = false;
            const dummyUtxoPos = 123;
            expect(await this.contract.getStandardExitId(isDeposit, dummyTxBytes, dummyUtxoPos))
                .to.be.bignumber.equal(new BN('704295667765845213537803190927618712114942801977'));
        });
    });

    describe('getInFlightExitId', () => {
        it('should get correct in-flight exit id', async () => {
            const output = new PaymentTransactionOutput(100, OUTPUT_GUARD, constants.ZERO_ADDRESS);
            const transaction = new PaymentTransaction(1, [DUMMY_INPUT], [output], EMPTY_BYTES32);
            const transactionBytes = web3.utils.bytesToHex(transaction.rlpEncoded());

            expect(await this.contract.getInFlightExitId(transactionBytes))
                .to.be.bignumber.equal(new BN('4944298339924871819243065897366095287396956217'));
        });
    });
});
