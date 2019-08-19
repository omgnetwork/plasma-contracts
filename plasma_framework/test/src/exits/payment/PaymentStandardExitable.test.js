const ExitableTimestamp = artifacts.require('ExitableTimestampWrapper');
const ExitId = artifacts.require('ExitIdWrapper');
const ERC20Mintable = artifacts.require('ERC20Mintable');
const IsDeposit = artifacts.require('IsDepositWrapper');
const OutputGuardParser = artifacts.require('DummyOutputGuardParser');
const PaymentStandardExitable = artifacts.require('PaymentStandardExitableMock');
const PaymentSpendingConditionExpected = artifacts.require('PaymentSpendingConditionExpected');
const PaymentSpendingConditionFalse = artifacts.require('PaymentSpendingConditionFalse');
const PaymentSpendingConditionTrue = artifacts.require('PaymentSpendingConditionTrue');
const PaymentSpendingConditionRevert = artifacts.require('PaymentSpendingConditionRevert');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { MerkleTree } = require('../../../helpers/merkle.js');
const { buildUtxoPos, utxoPosToTxPos } = require('../../../helpers/positions.js');
const {
    addressToOutputGuard, buildOutputGuard, computeDepositOutputId,
    computeNormalOutputId, spentOnGas,
} = require('../../../helpers/utils.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../../../helpers/transaction.js');


contract('PaymentStandardExitable', ([_, alice, bob]) => {
    const STANDARD_EXIT_BOND = 31415926535; // wei
    const ETH = constants.ZERO_ADDRESS;
    const CHILD_BLOCK_INTERVAL = 1000;
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const OUTPUT_TYPE_ZERO = 0;
    const EMPTY_BYTES = '0x0000000000000000000000000000000000000000000000000000000000000000000000';
    const EMPTY_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

    describe('startStandardExit', () => {
        const buildTestData = (amount, owner, blockNum) => {
            const output = new PaymentTransactionOutput(amount, addressToOutputGuard(owner), ETH);
            const txObj = new PaymentTransaction(1, [0], [output]);
            const tx = web3.utils.bytesToHex(txObj.rlpEncoded());

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

            this.dummyAmount = 1000;
            this.dummyBlockNum = 1001;
        });

        beforeEach(async () => {
            this.framework = await SpyPlasmaFramework.new(
                MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
            );

            const ethVault = await SpyEthVault.new(this.framework.address);
            const erc20Vault = await SpyErc20Vault.new(this.framework.address);
            this.exitGame = await PaymentStandardExitable.new(
                this.framework.address, ethVault.address, erc20Vault.address,
            );
        });

        it('should fail when cannot prove the tx is included in the block', async () => {
            const data = buildTestData(this.dummyAmount, alice, this.dummyBlockNum);
            const fakeRoot = web3.utils.sha3('fake root data');

            await this.framework.setBlock(this.dummyBlockNum, fakeRoot, 0);

            await expectRevert(
                this.exitGame.startStandardExit(
                    data.utxoPos, data.tx, OUTPUT_TYPE_ZERO, EMPTY_BYTES, data.merkleProof,
                    { from: alice, value: STANDARD_EXIT_BOND },
                ),
                'transaction inclusion proof failed',
            );
        });

        it('should fail when exit with amount of 0', async () => {
            const testAmountZero = 0;
            const data = buildTestData(testAmountZero, alice, this.dummyBlockNum);

            await this.framework.setBlock(this.dummyBlockNum, data.merkleTree.root, 0);

            await expectRevert(
                this.exitGame.startStandardExit(
                    data.utxoPos, data.tx, OUTPUT_TYPE_ZERO, EMPTY_BYTES, data.merkleProof,
                    { from: alice, value: STANDARD_EXIT_BOND },
                ),
                'Should not exit with amount 0',
            );
        });

        it('should fail when amount of bond is invalid', async () => {
            const data = buildTestData(this.dummyAmount, alice, this.dummyBlockNum);

            await this.framework.setBlock(this.dummyBlockNum, data.merkleTree.root, 0);

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
            const data = buildTestData(this.dummyAmount, alice, this.dummyBlockNum);

            await this.framework.setBlock(this.dummyBlockNum, data.merkleTree.root, 0);

            const nonOutputOwner = bob;
            await expectRevert(
                this.exitGame.startStandardExit(
                    data.utxoPos, data.tx, OUTPUT_TYPE_ZERO, EMPTY_BYTES, data.merkleProof,
                    { from: nonOutputOwner, value: STANDARD_EXIT_BOND },
                ),
                'Only exit target can start an exit',
            );
        });

        it('should fail when output guard mismatches the pre-image data given output type non 0', async () => {
            const data = buildTestData(this.dummyAmount, alice, this.dummyBlockNum);

            const outputGuardExitTarget = alice;
            const parser = await OutputGuardParser.new(outputGuardExitTarget);
            await this.exitGame.registerOutputGuardParser(1, parser.address);

            await this.framework.setBlock(this.dummyBlockNum, data.merkleTree.root, 0);

            const outputType = 1;
            const mismatchOutputguardData = EMPTY_BYTES;
            await expectRevert(
                this.exitGame.startStandardExit(
                    data.utxoPos, data.tx, outputType, mismatchOutputguardData, data.merkleProof,
                    { from: alice, value: STANDARD_EXIT_BOND },
                ),
                'Output guard data does not match pre-image',
            );
        });

        it('should fail when output guard parser is not registered with the output type given output type non 0', async () => {
            const outputType = 1;
            const outputGuardData = web3.utils.toHex(alice);
            const outputGuard = buildOutputGuard(outputType, outputGuardData);

            const data = buildTestData(this.dummyAmount, outputGuard, this.dummyBlockNum);

            await this.framework.setBlock(this.dummyBlockNum, data.merkleTree.root, 0);

            await expectRevert(
                this.exitGame.startStandardExit(
                    data.utxoPos, data.tx, outputType, outputGuardData, data.merkleProof,
                    { from: alice, value: STANDARD_EXIT_BOND },
                ),
                'Failed to get the output guard parser for the output type',
            );
        });

        it('should fail when same exit already started', async () => {
            const data = buildTestData(this.dummyAmount, alice, this.dummyBlockNum);

            await this.framework.setBlock(this.dummyBlockNum, data.merkleTree.root, 0);

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

        it('should charge the bond from the user', async () => {
            const data = buildTestData(this.dummyAmount, alice, this.dummyBlockNum);

            await this.framework.setBlock(this.dummyBlockNum, data.merkleTree.root, 0);

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

        it('should save the correct StandardExit data when successfully done for deposit tx', async () => {
            const outputOwner = alice;
            const depositBlockNum = 2019;
            const data = buildTestData(this.dummyAmount, alice, depositBlockNum);

            await this.framework.setBlock(depositBlockNum, data.merkleTree.root, 0);

            await this.exitGame.startStandardExit(
                data.utxoPos, data.tx, OUTPUT_TYPE_ZERO, EMPTY_BYTES, data.merkleProof,
                { from: alice, value: STANDARD_EXIT_BOND },
            );

            const isTxDeposit = true;
            const exitId = await this.exitIdHelper.getStandardExitId(isTxDeposit, data.tx, data.utxoPos);
            const outputId = computeDepositOutputId(data.tx, data.outputIndex, data.utxoPos);

            const expectedOutputTypeAndGuardHash = web3.utils.soliditySha3(
                { t: 'uint256', v: OUTPUT_TYPE_ZERO }, { t: 'bytes32', v: addressToOutputGuard(outputOwner) },
            );

            const standardExitData = await this.exitGame.exits(exitId);

            expect(standardExitData.exitable).to.be.true;
            expect(standardExitData.utxoPos).to.be.bignumber.equal(new BN(data.utxoPos));
            expect(standardExitData.outputId).to.equal(outputId);
            expect(standardExitData.outputTypeAndGuardHash).to.equal(expectedOutputTypeAndGuardHash);
            expect(standardExitData.exitTarget).to.equal(outputOwner);
            expect(standardExitData.token).to.equal(ETH);
            expect(standardExitData.amount).to.be.bignumber.equal(new BN(this.dummyAmount));
        });

        it('should save the correct StandardExit data when successfully done for non deposit tx', async () => {
            const outputOwner = alice;
            const nonDepositBlockNum = 1000;
            const data = buildTestData(this.dummyAmount, alice, nonDepositBlockNum, false);

            await this.framework.setBlock(nonDepositBlockNum, data.merkleTree.root, 0);

            await this.exitGame.startStandardExit(
                data.utxoPos, data.tx, OUTPUT_TYPE_ZERO, EMPTY_BYTES, data.merkleProof,
                { from: alice, value: STANDARD_EXIT_BOND },
            );

            const isTxDeposit = false;
            const exitId = await this.exitIdHelper.getStandardExitId(isTxDeposit, data.tx, data.utxoPos);
            const outputId = computeNormalOutputId(data.tx, data.outputIndex);

            const expectedOutputTypeAndGuardHash = web3.utils.soliditySha3(
                { t: 'uint256', v: OUTPUT_TYPE_ZERO }, { t: 'bytes32', v: addressToOutputGuard(outputOwner) },
            );

            const standardExitData = await this.exitGame.exits(exitId);

            expect(standardExitData.exitable).to.be.true;
            expect(standardExitData.utxoPos).to.be.bignumber.equal(new BN(data.utxoPos));
            expect(standardExitData.outputId).to.equal(outputId);
            expect(standardExitData.outputTypeAndGuardHash).to.equal(expectedOutputTypeAndGuardHash);
            expect(standardExitData.exitTarget).to.equal(outputOwner);
            expect(standardExitData.token).to.equal(ETH);
            expect(standardExitData.amount).to.be.bignumber.equal(new BN(this.dummyAmount));
        });

        it('should put the exit data into the queue of framework', async () => {
            const data = buildTestData(this.dummyAmount, alice, this.dummyBlockNum);

            await this.framework.setBlock(this.dummyBlockNum, data.merkleTree.root, 0);

            const { receipt } = await this.exitGame.startStandardExit(
                data.utxoPos, data.tx, OUTPUT_TYPE_ZERO, EMPTY_BYTES, data.merkleProof,
                { from: alice, value: STANDARD_EXIT_BOND },
            );

            const isTxDeposit = await this.isDeposit.test(this.dummyBlockNum);
            const exitId = await this.exitIdHelper.getStandardExitId(isTxDeposit, data.tx, data.utxoPos);

            const currentTimestamp = await time.latest();
            const dummyTimestampNoImpactOnExitableAt = currentTimestamp.sub(new BN(15));
            const exitableAt = await this.exitableHelper.calculate(
                currentTimestamp, dummyTimestampNoImpactOnExitableAt, isTxDeposit,
            );

            await expectEvent.inTransaction(
                receipt.transactionHash,
                SpyPlasmaFramework,
                'EnqueueTriggered',
                {
                    token: ETH,
                    exitableAt,
                    txPos: new BN(utxoPosToTxPos(data.utxoPos)),
                    exitProcessor: this.exitGame.address,
                    exitId,
                },
            );
        });

        it('should emit ExitStarted event', async () => {
            const data = buildTestData(this.dummyAmount, alice, this.dummyBlockNum);

            await this.framework.setBlock(this.dummyBlockNum, data.merkleTree.root, 0);

            const isTxDeposit = await this.isDeposit.test(this.dummyBlockNum);
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
        const getTestInputArgs = (outputType, outputGuard) => ({
            exitId: 123,
            outputType,
            outputGuard,
            challengeTxType: 1,
            challengeTx: EMPTY_BYTES,
            inputIndex: 0,
            witness: EMPTY_BYTES,
        });

        const getOutputTypeAndGuardHash = input => web3.utils.soliditySha3(
            { t: 'uint256', v: input.outputType },
            { t: 'bytes32', v: input.outputGuard },
        );

        const getTestExitData = (outputTypeAndGuardHash, exitTarget) => ({
            exitable: true,
            utxoPos: buildUtxoPos(1, 0, 0),
            outputId: web3.utils.sha3('random'),
            outputTypeAndGuardHash,
            token: ETH,
            exitTarget,
            amount: 66666,
        });

        const getExpectedConditionInputArgs = (input, exitData) => ({
            outputGuard: input.outputGuard,
            utxoPos: 0, // should not be used, see: https://github.com/omisego/plasma-contracts/pull/212
            outputId: web3.eth.abi.encodeParameter('uint256', exitData.utxoPos.toString()),
            spendingTx: input.challengeTx,
            inputIndex: input.inputIndex,
            witness: input.witness,
        });

        beforeEach(async () => {
            this.framework = await SpyPlasmaFramework.new(
                MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
            );

            const ethVault = await SpyEthVault.new(this.framework.address);
            const erc20Vault = await SpyErc20Vault.new(this.framework.address);
            this.exitGame = await PaymentStandardExitable.new(
                this.framework.address, ethVault.address, erc20Vault.address,
            );
        });

        it('should fail when exit for such exit id does not exists', async () => {
            const input = getTestInputArgs(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            await expectRevert(
                this.exitGame.challengeStandardExit(input),
                'Such exit does not exist',
            );
        });

        it('should fail when output type mismatch exit data', async () => {
            const input = getTestInputArgs(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            const mismatchInput = Object.assign({}, input);
            mismatchInput.outputType += 1;

            const outputTypeAndGuardHash = getOutputTypeAndGuardHash(mismatchInput);
            await this.exitGame.setExit(input.exitId, getTestExitData(outputTypeAndGuardHash, alice));

            await expectRevert(
                this.exitGame.challengeStandardExit(input),
                'Either output type or output guard of challenge input args is invalid for the exit',
            );
        });

        it('should fail when output guard mismatch exit data', async () => {
            const input = getTestInputArgs(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            const mismatchInput = Object.assign({}, input);
            mismatchInput.outputGuard = web3.utils.sha3(mismatchInput.outputGuard);

            const outputTypeAndGuardHash = getOutputTypeAndGuardHash(mismatchInput);
            await this.exitGame.setExit(input.exitId, getTestExitData(outputTypeAndGuardHash, alice));

            await expectRevert(
                this.exitGame.challengeStandardExit(input),
                'Either output type or output guard of challenge input args is invalid for the exit',
            );
        });

        it('should fail when not able to find the spending condition contract', async () => {
            const input = getTestInputArgs(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            const outputTypeAndGuardHash = getOutputTypeAndGuardHash(input);
            await this.exitGame.setExit(input.exitId, getTestExitData(outputTypeAndGuardHash, alice));

            await expectRevert(
                this.exitGame.challengeStandardExit(input),
                'Spending condition contract not found',
            );
        });

        it('should fail when spending condition contract returns false', async () => {
            const input = getTestInputArgs(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            const outputTypeAndGuardHash = getOutputTypeAndGuardHash(input);
            const conditionFalse = await PaymentSpendingConditionFalse.new();
            await this.exitGame.registerSpendingCondition(
                input.outputType, input.challengeTxType, conditionFalse.address,
            );

            await this.exitGame.setExit(input.exitId, getTestExitData(outputTypeAndGuardHash, alice));

            await expectRevert(
                this.exitGame.challengeStandardExit(input),
                'Spending condition failed',
            );
        });

        it('should fail when spending condition contract reverts', async () => {
            const input = getTestInputArgs(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            const outputTypeAndGuardHash = getOutputTypeAndGuardHash(input);
            const conditionRevert = await PaymentSpendingConditionRevert.new();
            await this.exitGame.registerSpendingCondition(
                input.outputType, input.challengeTxType, conditionRevert.address,
            );

            await this.exitGame.setExit(input.exitId, getTestExitData(outputTypeAndGuardHash, alice));

            const revertMessage = await conditionRevert.revertMessage();
            await expectRevert(
                this.exitGame.challengeStandardExit(input),
                revertMessage,
            );
        });

        it('should call the Spending Condition contract with expected params given output type 0', async () => {
            await this.exitGame.depositFundForTest({ value: STANDARD_EXIT_BOND });

            const input = getTestInputArgs(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            const outputTypeAndGuardHash = getOutputTypeAndGuardHash(input);
            const conditionExpected = await PaymentSpendingConditionExpected.new();
            const exitTarget = alice;
            const testExitData = getTestExitData(outputTypeAndGuardHash, exitTarget);

            // Spending condition mock reverts when it's called with arguments
            // that does not match expectedConditionInput
            const expectedConditionInput = getExpectedConditionInputArgs(input, testExitData);
            await conditionExpected.setExpected(expectedConditionInput);

            await this.exitGame.registerSpendingCondition(
                input.outputType, input.challengeTxType, conditionExpected.address,
            );

            await this.exitGame.setExit(input.exitId, testExitData);

            await this.exitGame.challengeStandardExit(input);
            const exitData = await this.exitGame.exits(input.exitId);
            expect(exitData.exitable).to.be.false;
        });

        it('should call the Spending Condition contract with expected params given output type non 0', async () => {
            await this.exitGame.depositFundForTest({ value: STANDARD_EXIT_BOND });

            const outputType = 1;
            const dummyOutputGuard = `0x${Array(64).fill(1).join('')}`;
            const input = getTestInputArgs(outputType, dummyOutputGuard);
            const outputTypeAndGuardHash = getOutputTypeAndGuardHash(input);
            const conditionExpected = await PaymentSpendingConditionExpected.new();
            const exitTarget = alice;
            const testExitData = getTestExitData(outputTypeAndGuardHash, exitTarget);

            // Spending condition mock reverts when it's called with arguments
            // that does not match expectedConditionInput
            const expectedConditionInput = getExpectedConditionInputArgs(input, testExitData);
            await conditionExpected.setExpected(expectedConditionInput);

            await this.exitGame.registerSpendingCondition(
                input.outputType, input.challengeTxType, conditionExpected.address,
            );

            await this.exitGame.setExit(input.exitId, testExitData);

            await this.exitGame.challengeStandardExit(input);
            const exitData = await this.exitGame.exits(input.exitId);
            expect(exitData.exitable).to.be.false;
        });

        it('should delete the exit data when successfully challenged', async () => {
            await this.exitGame.depositFundForTest({ value: STANDARD_EXIT_BOND });

            const input = getTestInputArgs(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            const outputTypeAndGuardHash = getOutputTypeAndGuardHash(input);
            const conditionTrue = await PaymentSpendingConditionTrue.new();
            await this.exitGame.registerSpendingCondition(
                input.outputType, input.challengeTxType, conditionTrue.address,
            );

            await this.exitGame.setExit(input.exitId, getTestExitData(outputTypeAndGuardHash, alice));

            await this.exitGame.challengeStandardExit(input);

            const exitData = await this.exitGame.exits(input.exitId);
            Object.values(exitData).map(
                val => (BN.isBN(val) ? val.toNumber() : val),
            ).forEach((val) => {
                expect(val).to.be.oneOf([false, 0, EMPTY_BYTES32, constants.ZERO_ADDRESS]);
            });
        });

        it('should transfer the standard exit bond to challenger when successfully challenged', async () => {
            await this.exitGame.depositFundForTest({ value: STANDARD_EXIT_BOND });

            const input = getTestInputArgs(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            const outputTypeAndGuardHash = getOutputTypeAndGuardHash(input);
            const conditionTrue = await PaymentSpendingConditionTrue.new();
            await this.exitGame.registerSpendingCondition(
                input.outputType, input.challengeTxType, conditionTrue.address,
            );

            await this.exitGame.setExit(input.exitId, getTestExitData(outputTypeAndGuardHash, alice));

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

            const input = getTestInputArgs(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            const outputTypeAndGuardHash = getOutputTypeAndGuardHash(input);
            const testExitData = getTestExitData(outputTypeAndGuardHash, alice);

            const conditionTrue = await PaymentSpendingConditionTrue.new();
            await this.exitGame.registerSpendingCondition(
                input.outputType, input.challengeTxType, conditionTrue.address,
            );

            await this.exitGame.setExit(input.exitId, testExitData);

            const { logs } = await this.exitGame.challengeStandardExit(input);

            expectEvent.inLogs(
                logs,
                'ExitChallenged',
                { utxoPos: new BN(testExitData.utxoPos) },
            );
        });
    });

    describe('processStandardExit', () => {
        beforeEach(async () => {
            this.framework = await SpyPlasmaFramework.new(
                MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
            );

            const ethVault = await SpyEthVault.new(this.framework.address);
            const erc20Vault = await SpyErc20Vault.new(this.framework.address);
            this.exitGame = await PaymentStandardExitable.new(
                this.framework.address, ethVault.address, erc20Vault.address,
            );
            this.framework.registerExitGame(1, this.exitGame.address);

            // prepare the bond that should be set when exit starts
            await this.exitGame.depositFundForTest({ value: STANDARD_EXIT_BOND });
        });

        const getTestExitData = (exitable, token) => ({
            exitable,
            utxoPos: buildUtxoPos(1, 0, 0),
            outputId: web3.utils.sha3('output id'),
            outputTypeAndGuardHash: web3.utils.sha3('outputTypeAndGuardHash'),
            token,
            exitTarget: alice,
            amount: web3.utils.toWei('3', 'ether'),
        });

        it('should not process the exit when such exit is not exitable', async () => {
            const exitId = 1;
            const exitable = false;
            const testExitData = getTestExitData(exitable, ETH);
            await this.exitGame.setExit(exitId, testExitData);

            const { logs } = await this.exitGame.processExit(exitId);

            expectEvent.inLogs(
                logs,
                'ExitOmitted',
                { exitId: new BN(exitId) },
            );
        });

        it('should not process the exit when output already flagged as spent', async () => {
            const exitId = 1;
            const testExitData = getTestExitData(true, ETH);
            await this.exitGame.setExit(exitId, testExitData);
            await this.exitGame.proxyFlagOutputSpent(testExitData.outputId);

            const { logs } = await this.exitGame.processExit(exitId);

            expectEvent.inLogs(
                logs,
                'ExitOmitted',
                { exitId: new BN(exitId) },
            );
        });

        it('should flag the output spent when sucessfully processed', async () => {
            const exitId = 1;
            const testExitData = getTestExitData(true, ETH);
            await this.exitGame.setExit(exitId, testExitData);

            await this.exitGame.processExit(exitId);

            expect(await this.framework.isOutputSpent(testExitData.outputId)).to.be.true;
        });

        it('should return standard exit bond to exit target when the exit token is ETH', async () => {
            const exitId = 1;
            const testExitData = getTestExitData(true, ETH);
            await this.exitGame.setExit(exitId, testExitData);

            const preBalance = new BN(await web3.eth.getBalance(testExitData.exitTarget));
            await this.exitGame.processExit(exitId);
            const postBalance = new BN(await web3.eth.getBalance(testExitData.exitTarget));
            const expectBalance = preBalance.add(new BN(STANDARD_EXIT_BOND));

            expect(postBalance).to.be.bignumber.equal(expectBalance);
        });

        it('should return standard exit bond to exit target when the exit token is ERC20', async () => {
            const exitId = 1;
            const erc20Token = (await ERC20Mintable.new()).address;
            const testExitData = getTestExitData(true, erc20Token);
            await this.exitGame.setExit(exitId, testExitData);

            const preBalance = new BN(await web3.eth.getBalance(testExitData.exitTarget));
            await this.exitGame.processExit(exitId);
            const postBalance = new BN(await web3.eth.getBalance(testExitData.exitTarget));
            const expectBalance = preBalance.add(new BN(STANDARD_EXIT_BOND));

            expect(postBalance).to.be.bignumber.equal(expectBalance);
        });

        it('should call the ETH vault with exit amount when the exit token is ETH', async () => {
            const exitId = 1;
            const testExitData = getTestExitData(true, ETH);
            await this.exitGame.setExit(exitId, testExitData);

            const { receipt } = await this.exitGame.processExit(exitId);
            await expectEvent.inTransaction(
                receipt.transactionHash,
                SpyEthVault,
                'EthWithdrawCalled',
                {
                    target: testExitData.exitTarget,
                    amount: new BN(testExitData.amount),
                },
            );
        });

        it('should call the Erc20 vault with exit amount when the exit token is an ERC 20 token', async () => {
            const exitId = 1;
            const erc20Token = (await ERC20Mintable.new()).address;
            const testExitData = getTestExitData(true, erc20Token);
            await this.exitGame.setExit(exitId, testExitData);

            const { receipt } = await this.exitGame.processExit(exitId);

            await expectEvent.inTransaction(
                receipt.transactionHash,
                SpyErc20Vault,
                'Erc20WithdrawCalled',
                {
                    target: testExitData.exitTarget,
                    token: testExitData.token,
                    amount: new BN(testExitData.amount),
                },
            );
        });

        it('should deletes the standard exit data', async () => {
            const exitId = 1;
            const testExitData = getTestExitData(true, ETH);
            await this.exitGame.setExit(exitId, testExitData);

            await this.exitGame.processExit(exitId);

            const exitData = await this.exitGame.exits(exitId);

            Object.values(exitData).map(
                val => (BN.isBN(val) ? val.toNumber() : val),
            ).forEach((val) => {
                expect(val).to.be.oneOf([false, 0, EMPTY_BYTES32, constants.ZERO_ADDRESS]);
            });
        });

        it('should emit ExitFinalized event', async () => {
            const exitId = 1;
            const testExitData = getTestExitData(true, ETH);
            await this.exitGame.setExit(exitId, testExitData);

            const { logs } = await this.exitGame.processExit(exitId);

            expectEvent.inLogs(
                logs,
                'ExitFinalized',
                { exitId: new BN(exitId) },
            );
        });
    });
});
