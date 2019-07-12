const PaymentStandardExitable = artifacts.require('PaymentStandardExitableMock');
const PaymentSpendingConditionExpected = artifacts.require('PaymentSpendingConditionExpected');
const PaymentSpendingConditionFalse = artifacts.require('PaymentSpendingConditionFalse');
const PaymentSpendingConditionTrue = artifacts.require('PaymentSpendingConditionTrue');
const PaymentSpendingConditionRevert = artifacts.require('PaymentSpendingConditionRevert');
const DummyPlasmaFramework = artifacts.require('DummyPlasmaFramework');
const DummyVault = artifacts.require('DummyVault');
const ExitId = artifacts.require('ExitIdWrapper');
const OutputGuardParser = artifacts.require('DummyOutputGuardParser');
const IsDeposit = artifacts.require('IsDepositWrapper');
const ExitableTimestamp = artifacts.require('ExitableTimestampWrapper');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { MerkleTree } = require('../../../helpers/merkle.js');
const { buildUtxoPos } = require('../../../helpers/utxoPos.js');
const {
    addressToOutputGuard, buildOutputGuard, computeOutputId, spentOnGas,
} = require('../../../helpers/utils.js');
const Testlang = require('../../../helpers/testlang.js');


contract('PaymentStandardExitable', ([_, alice, bob]) => {
    const STANDARD_EXIT_BOND = 31415926535; // wei
    const ETH = constants.ZERO_ADDRESS;
    const CHILD_BLOCK_INTERVAL = 1000;
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week
    const OUTPUT_TYPE_ZERO = 0;
    const EMPTY_BYTES = '0x0000000000000000000000000000000000000000000000000000000000000000000000';
    const EMPTY_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

    describe('startStandardExit', () => {
        const buildTestData = (amount, owner, blockNum) => {
            const tx = Testlang.deposit(amount, owner, ETH);
            const outputIndex = 0;
            const utxoPos = buildUtxoPos(blockNum, 0, outputIndex);
            const merkleTree = new MerkleTree([tx], 3);
            const merkleProof = merkleTree.getInclusionProof(tx);

            return {
                utxoPos, outputIndex, tx, merkleTree, merkleProof,
            };
        };

        before(async () => {
            this.exitIdHelper = await ExitId.new();
            this.isDeposit = await IsDeposit.new(CHILD_BLOCK_INTERVAL);
            this.exitableHelper = await ExitableTimestamp.new(MIN_EXIT_PERIOD);
        });

        beforeEach(async () => {
            this.framework = await DummyPlasmaFramework.new();
            this.exitGame = await PaymentStandardExitable.new(this.framework.address);
            this.vault = await DummyVault.new();
        });

        it('should fail when cannot prove the tx is included in the block', async () => {
            const testAmount = 1000;
            const dummyBlockNum = 1001;
            const data = buildTestData(testAmount, alice, dummyBlockNum);
            const fakeRoot = web3.utils.sha3('fake root data');

            await this.framework.setBlock(dummyBlockNum, fakeRoot, 0);

            await expectRevert(
                this.exitGame.startStandardExit(
                    data.utxoPos, data.tx, OUTPUT_TYPE_ZERO, EMPTY_BYTES, data.merkleProof,
                    { from: alice, value: STANDARD_EXIT_BOND },
                ),
                'transaction inclusion proof failed',
            );
        });

        it('should fail when exit with amount of 0', async () => {
            const testAmount = 0;
            const dummyBlockNum = 1001;
            const data = buildTestData(testAmount, alice, dummyBlockNum);

            await this.framework.setBlock(dummyBlockNum, data.merkleTree.root, 0);

            await expectRevert(
                this.exitGame.startStandardExit(
                    data.utxoPos, data.tx, OUTPUT_TYPE_ZERO, EMPTY_BYTES, data.merkleProof,
                    { from: alice, value: STANDARD_EXIT_BOND },
                ),
                'Should not exit with amount 0',
            );
        });

        it('should fail when amount of bond is invalid', async () => {
            const testAmount = 1000;
            const dummyBlockNum = 1001;
            const data = buildTestData(testAmount, alice, dummyBlockNum);

            await this.framework.setBlock(dummyBlockNum, data.merkleTree.root, 0);

            const invalidBond = STANDARD_EXIT_BOND - 100;
            await expectRevert(
                this.exitGame.startStandardExit(
                    data.utxoPos, data.tx, OUTPUT_TYPE_ZERO, EMPTY_BYTES, data.merkleProof,
                    { from: alice, value: invalidBond },
                ),
                'Input value mismatches with msg.value',
            );
        });

        it('should fail when not initiated by the exit target', async () => {
            const testAmount = 1000;
            const dummyBlockNum = 1001;
            const data = buildTestData(testAmount, alice, dummyBlockNum);

            await this.framework.setBlock(dummyBlockNum, data.merkleTree.root, 0);

            const nonOutputOwner = bob;
            await expectRevert(
                this.exitGame.startStandardExit(
                    data.utxoPos, data.tx, OUTPUT_TYPE_ZERO, EMPTY_BYTES, data.merkleProof,
                    { from: nonOutputOwner, value: STANDARD_EXIT_BOND },
                ),
                'Only exit target can start an exit',
            );
        });

        it('should fail when output guard mismatch pre-image data given output type non 0', async () => {
            const testAmount = 1000;
            const dummyBlockNum = 1001;
            const data = buildTestData(testAmount, alice, dummyBlockNum);

            const outputGuardExitTarget = alice;
            const parser = await OutputGuardParser.new(outputGuardExitTarget);
            await this.exitGame.registerOutputGuardParser(1, parser.address);

            await this.framework.setBlock(dummyBlockNum, data.merkleTree.root, 0);

            const outputType = 1;
            await expectRevert(
                this.exitGame.startStandardExit(
                    data.utxoPos, data.tx, outputType, EMPTY_BYTES, data.merkleProof,
                    { from: alice, value: STANDARD_EXIT_BOND },
                ),
                'Output guard data mismatch pre-image',
            );
        });

        it('should fail when output guard parser is not registered with the output type given output type non 0', async () => {
            const testAmount = 1000;
            const dummyBlockNum = 1001;
            const outputType = 1;
            const outputGuardData = web3.utils.toHex(alice);
            const outputGuard = buildOutputGuard(outputType, outputGuardData);

            const data = buildTestData(testAmount, outputGuard, dummyBlockNum);

            await this.framework.setBlock(dummyBlockNum, data.merkleTree.root, 0);

            await expectRevert(
                this.exitGame.startStandardExit(
                    data.utxoPos, data.tx, outputType, outputGuardData, data.merkleProof,
                    { from: alice, value: STANDARD_EXIT_BOND },
                ),
                'Failed to get the output guard parser for the output type',
            );
        });

        it('should fail when same exit already started', async () => {
            const testAmount = 1000;
            const dummyBlockNum = 1001;
            const data = buildTestData(testAmount, alice, dummyBlockNum);

            await this.framework.setBlock(dummyBlockNum, data.merkleTree.root, 0);

            await this.exitGame.startStandardExit(
                data.utxoPos, data.tx, OUTPUT_TYPE_ZERO, EMPTY_BYTES, data.merkleProof,
                { from: alice, value: STANDARD_EXIT_BOND },
            );

            await expectRevert(
                this.exitGame.startStandardExit(
                    data.utxoPos, data.tx, OUTPUT_TYPE_ZERO, EMPTY_BYTES, data.merkleProof,
                    { from: alice, value: STANDARD_EXIT_BOND },
                ),
                'Exit already started',
            );
        });

        it('should charge the bond for the user', async () => {
            const testAmount = 1000;
            const dummyBlockNum = 1001;
            const data = buildTestData(testAmount, alice, dummyBlockNum);

            await this.framework.setBlock(dummyBlockNum, data.merkleTree.root, 0);

            const preBalance = new BN(await web3.eth.getBalance(alice));
            const tx = await this.exitGame.startStandardExit(
                data.utxoPos, data.tx, OUTPUT_TYPE_ZERO, EMPTY_BYTES, data.merkleProof,
                { from: alice, value: STANDARD_EXIT_BOND },
            );
            const actualPostBalance = new BN(await web3.eth.getBalance(alice));
            const expectedPostBalance = preBalance
                .sub(new BN(STANDARD_EXIT_BOND))
                .sub(await spentOnGas(tx.receipt));

            expect(actualPostBalance).to.be.bignumber.equal(expectedPostBalance);
        });

        it('should save the StandardExit data when successfully done', async () => {
            const testAmount = 1000;
            const dummyBlockNum = 1001;
            const outputOwner = alice;
            const data = buildTestData(testAmount, outputOwner, dummyBlockNum);

            await this.framework.setBlock(dummyBlockNum, data.merkleTree.root, 0);

            await this.exitGame.startStandardExit(
                data.utxoPos, data.tx, OUTPUT_TYPE_ZERO, EMPTY_BYTES, data.merkleProof,
                { from: alice, value: STANDARD_EXIT_BOND },
            );

            const isTxDeposit = await this.isDeposit.test(dummyBlockNum);
            const exitId = await this.exitIdHelper.getStandardExitId(isTxDeposit, data.tx, data.utxoPos);
            const outputId = computeOutputId(
                isTxDeposit, data.tx, data.outputIndex, data.utxoPos,
            );

            const expectedOutputRelatedDataHash = web3.utils.soliditySha3(
                { t: 'uint256', v: data.utxoPos }, { t: 'bytes32', v: outputId },
                { t: 'uint256', v: OUTPUT_TYPE_ZERO }, { t: 'bytes32', v: addressToOutputGuard(outputOwner) },
            );

            const standardExitData = await this.exitGame.exits(exitId);

            expect(standardExitData.exitable).to.be.true;
            expect(standardExitData.outputRelatedDataHash).to.equal(expectedOutputRelatedDataHash);
            expect(standardExitData.exitTarget).to.equal(outputOwner);
            expect(standardExitData.token).to.equal(ETH);
            expect(standardExitData.amount).to.be.bignumber.equal(new BN(testAmount));
        });

        it('should put the exit data into the queue of framework', async () => {
            const testAmount = 1000;
            const dummyBlockNum = 1001;
            const data = buildTestData(testAmount, alice, dummyBlockNum);
            const currentTimestamp = await time.latest();
            const timestamp = currentTimestamp.sub(new BN(15));

            await this.framework.setBlock(dummyBlockNum, data.merkleTree.root, timestamp);

            await this.exitGame.startStandardExit(
                data.utxoPos, data.tx, OUTPUT_TYPE_ZERO, EMPTY_BYTES, data.merkleProof,
                { from: alice, value: STANDARD_EXIT_BOND },
            );

            const isTxDeposit = await this.isDeposit.test(dummyBlockNum);
            const exitId = await this.exitIdHelper.getStandardExitId(isTxDeposit, data.tx, data.utxoPos);
            const exitableAt = await this.exitableHelper.calculate(
                currentTimestamp, timestamp, isTxDeposit,
            );

            const queueKey = web3.utils.soliditySha3(data.utxoPos, ETH);
            const queueExitData = await this.framework.testExitQueue(queueKey);

            expect(queueExitData.exitId).to.be.bignumber.equal(exitId);
            expect(queueExitData.exitProcessor).to.equal(this.exitGame.address);
            expect(queueExitData.exitableAt).to.be.bignumber.equal(exitableAt);
        });

        it('should emit ExitStarted event', async () => {
            const testAmount = 1000;
            const dummyBlockNum = 1001;
            const data = buildTestData(testAmount, alice, dummyBlockNum);

            await this.framework.setBlock(dummyBlockNum, data.merkleTree.root, 0);

            const isTxDeposit = await this.isDeposit.test(dummyBlockNum);
            const exitId = await this.exitIdHelper.getStandardExitId(isTxDeposit, data.tx, data.utxoPos);
            const { logs } = await this.exitGame.startStandardExit(
                data.utxoPos, data.tx, OUTPUT_TYPE_ZERO, EMPTY_BYTES, data.merkleProof,
                { from: alice, value: STANDARD_EXIT_BOND },
            );

            expectEvent.inLogs(
                logs,
                'ExitStarted',
                { owner: alice, exitId },
            );
        });
    });

    describe('challengeStandardExit', () => {
        const getTestInput = (outputType, outputGuard) => ({
            exitId: 123,
            outputType,
            outputUtxoPos: buildUtxoPos(1, 0, 0),
            outputId: web3.utils.sha3('random'),
            outputGuard,
            challengeTxType: 1,
            challengeTx: EMPTY_BYTES,
            inputIndex: 0,
            witness: EMPTY_BYTES,
        });

        const getOutputRelatedDataHash = input => web3.utils.soliditySha3(
            { t: 'uint256', v: input.outputUtxoPos },
            { t: 'bytes32', v: input.outputId },
            { t: 'uint256', v: input.outputType },
            { t: 'bytes32', v: input.outputGuard },
        );

        const getExpectedConditionInput = input => ({
            outputGuard: input.outputGuard,
            utxoPos: input.outputUtxoPos,
            outputId: input.outputId,
            consumeTx: input.challengeTx,
            inputIndex: input.inputIndex,
            witness: input.witness,
        });

        const getTestExitData = (outputRelatedDataHash, exitTarget) => ({
            exitable: true,
            outputRelatedDataHash,
            token: ETH,
            exitTarget,
            amount: 66666,
        });

        beforeEach(async () => {
            this.framework = await DummyPlasmaFramework.new();
            this.exitGame = await PaymentStandardExitable.new(this.framework.address);
        });

        it('should fail when exit for such exit id does not exists', async () => {
            const input = getTestInput(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            await expectRevert(
                this.exitGame.challengeStandardExit(input),
                'Such exit does not exists',
            );
        });

        it('should fail when utxo pos mismatch exit data', async () => {
            const input = getTestInput(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            const mismatchUtxoPos = input.outputUtxoPos + 1;
            const outputRelatedDataHash = web3.utils.soliditySha3(
                { t: 'uint256', v: mismatchUtxoPos },
                { t: 'bytes32', v: input.outputId },
                { t: 'uint256', v: input.outputType },
                { t: 'bytes32', v: input.outputGuard },
            );

            await this.exitGame.setExit(input.exitId, getTestExitData(outputRelatedDataHash, alice));

            await expectRevert(
                this.exitGame.challengeStandardExit(input),
                'Some of the output related challenge data are invalid for the exit',
            );
        });

        it('should fail when output id mismatch exit data', async () => {
            const input = getTestInput(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            const mismatchOutputId = web3.utils.sha3(input.outputId);
            const outputRelatedDataHash = web3.utils.soliditySha3(
                { t: 'uint256', v: input.outputUtxoPos },
                { t: 'bytes32', v: mismatchOutputId },
                { t: 'uint256', v: input.outputType },
                { t: 'bytes32', v: input.outputGuard },
            );

            await this.exitGame.setExit(input.exitId, getTestExitData(outputRelatedDataHash, alice));

            await expectRevert(
                this.exitGame.challengeStandardExit(input),
                'Some of the output related challenge data are invalid for the exit',
            );
        });

        it('should fail when output type mismatch exit data', async () => {
            const input = getTestInput(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            const mismatchOutputType = input.outputType + 1;
            const outputRelatedDataHash = web3.utils.soliditySha3(
                { t: 'uint256', v: input.outputUtxoPos },
                { t: 'bytes32', v: input.outputId },
                { t: 'uint256', v: mismatchOutputType },
                { t: 'bytes32', v: input.outputGuard },
            );

            await this.exitGame.setExit(input.exitId, getTestExitData(outputRelatedDataHash, alice));

            await expectRevert(
                this.exitGame.challengeStandardExit(input),
                'Some of the output related challenge data are invalid for the exit',
            );
        });

        it('should fail when output guard mismatch exit data', async () => {
            const input = getTestInput(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            const mismatchOutputGuard = web3.utils.sha3('mismatch output guard');
            const outputRelatedDataHash = web3.utils.soliditySha3(
                { t: 'uint256', v: input.outputUtxoPos },
                { t: 'bytes32', v: input.outputId },
                { t: 'uint256', v: input.outputType },
                { t: 'bytes32', v: mismatchOutputGuard },
            );

            await this.exitGame.setExit(input.exitId, getTestExitData(outputRelatedDataHash, alice));

            await expectRevert(
                this.exitGame.challengeStandardExit(input),
                'Some of the output related challenge data are invalid for the exit',
            );
        });

        it('should fail when not able to find the spending condition contract', async () => {
            const input = getTestInput(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            const outputRelatedDataHash = getOutputRelatedDataHash(input);
            await this.exitGame.setExit(input.exitId, getTestExitData(outputRelatedDataHash, alice));

            await expectRevert(
                this.exitGame.challengeStandardExit(input),
                'Spending condition contract not found',
            );
        });

        it('should fail when spending condition contract returns false', async () => {
            const input = getTestInput(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            const outputRelatedDataHash = getOutputRelatedDataHash(input);
            const conditionFalse = await PaymentSpendingConditionFalse.new();
            await this.exitGame.registerSpendingCondition(
                input.outputType, input.challengeTxType, conditionFalse.address,
            );

            await this.exitGame.setExit(input.exitId, getTestExitData(outputRelatedDataHash, alice));

            await expectRevert(
                this.exitGame.challengeStandardExit(input),
                'Spending condition failed',
            );
        });

        it('should fail when spending condition contract reverts', async () => {
            const input = getTestInput(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            const outputRelatedDataHash = getOutputRelatedDataHash(input);
            const conditionRevert = await PaymentSpendingConditionRevert.new();
            await this.exitGame.registerSpendingCondition(
                input.outputType, input.challengeTxType, conditionRevert.address,
            );

            await this.exitGame.setExit(input.exitId, getTestExitData(outputRelatedDataHash, alice));

            const revertMessage = await conditionRevert.revertMessage();
            await expectRevert(
                this.exitGame.challengeStandardExit(input),
                revertMessage,
            );
        });

        it('should calls the Spending Condition contract with expected params given output type 0', async () => {
            await this.exitGame.depositFundForTest({ value: STANDARD_EXIT_BOND });

            const input = getTestInput(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            const outputRelatedDataHash = getOutputRelatedDataHash(input);
            const conditionExpected = await PaymentSpendingConditionExpected.new();
            const exitTarget = alice;

            // spending condition contract would only returns true
            // when expected data is as input params during 'verify(...)' called.
            const expectedConditionInput = getExpectedConditionInput(input);
            await conditionExpected.setExpected(expectedConditionInput);

            await this.exitGame.registerSpendingCondition(
                input.outputType, input.challengeTxType, conditionExpected.address,
            );

            await this.exitGame.setExit(input.exitId, getTestExitData(outputRelatedDataHash, exitTarget));

            await this.exitGame.challengeStandardExit(input);
            const exitData = await this.exitGame.exits(input.exitId);
            expect(exitData.exitable).to.be.false;
        });

        it('should calls the Spending Condition contract with expected params given output type non 0', async () => {
            await this.exitGame.depositFundForTest({ value: STANDARD_EXIT_BOND });

            const outputType = 1;
            const dummyOutputGuard = `0x${Array(64).fill(1).join('')}`;
            const input = getTestInput(outputType, dummyOutputGuard);
            const outputRelatedDataHash = getOutputRelatedDataHash(input);
            const conditionExpected = await PaymentSpendingConditionExpected.new();
            const exitTarget = alice;

            // spending condition contract would only returns true
            // when expected data is as input params during 'verify(...)' called.
            const expectedConditionInput = getExpectedConditionInput(input);
            await conditionExpected.setExpected(expectedConditionInput);

            await this.exitGame.registerSpendingCondition(
                input.outputType, input.challengeTxType, conditionExpected.address,
            );

            await this.exitGame.setExit(input.exitId, getTestExitData(outputRelatedDataHash, exitTarget));

            await this.exitGame.challengeStandardExit(input);
            const exitData = await this.exitGame.exits(input.exitId);
            expect(exitData.exitable).to.be.false;
        });

        it('should deletes the exit data when successfully challenged', async () => {
            await this.exitGame.depositFundForTest({ value: STANDARD_EXIT_BOND });

            const input = getTestInput(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            const outputRelatedDataHash = getOutputRelatedDataHash(input);
            const conditionTrue = await PaymentSpendingConditionTrue.new();
            await this.exitGame.registerSpendingCondition(
                input.outputType, input.challengeTxType, conditionTrue.address,
            );

            await this.exitGame.setExit(input.exitId, getTestExitData(outputRelatedDataHash, alice));

            await this.exitGame.challengeStandardExit(input);

            const exitData = await this.exitGame.exits(input.exitId);
            expect(exitData.exitable).to.be.false;
            expect(exitData.outputRelatedDataHash).to.equal(EMPTY_BYTES32);
            expect(exitData.token).to.equal(constants.ZERO_ADDRESS);
            expect(exitData.exitTarget).to.equal(constants.ZERO_ADDRESS);
            expect(exitData.amount.toNumber()).to.equal(0);
        });

        it('should transfer the standard exit bond to challenger when successfully challenged', async () => {
            await this.exitGame.depositFundForTest({ value: STANDARD_EXIT_BOND });

            const input = getTestInput(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            const outputRelatedDataHash = getOutputRelatedDataHash(input);
            const conditionTrue = await PaymentSpendingConditionTrue.new();
            await this.exitGame.registerSpendingCondition(
                input.outputType, input.challengeTxType, conditionTrue.address,
            );

            await this.exitGame.setExit(input.exitId, getTestExitData(outputRelatedDataHash, alice));

            const preBalance = new BN(await web3.eth.getBalance(bob));

            const tx = await this.exitGame.challengeStandardExit(
                input, { from: bob },
            );

            const actualPostBalance = new BN(await web3.eth.getBalance(bob));
            const expectedPostBalance = preBalance
                .add(new BN(STANDARD_EXIT_BOND))
                .sub(await spentOnGas(tx.receipt));

            expect(actualPostBalance).to.be.bignumber.equal(expectedPostBalance);
        });

        it('should emit ExitChallenged event when successfully challenged', async () => {
            await this.exitGame.depositFundForTest({ value: STANDARD_EXIT_BOND });

            const input = getTestInput(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            const outputRelatedDataHash = getOutputRelatedDataHash(input);
            const conditionTrue = await PaymentSpendingConditionTrue.new();
            await this.exitGame.registerSpendingCondition(
                input.outputType, input.challengeTxType, conditionTrue.address,
            );

            await this.exitGame.setExit(input.exitId, getTestExitData(outputRelatedDataHash, alice));

            const { logs } = await this.exitGame.challengeStandardExit(input);

            expectEvent.inLogs(
                logs,
                'ExitChallenged',
                { utxoPos: new BN(input.outputUtxoPos) },
            );
        });
    });
});
