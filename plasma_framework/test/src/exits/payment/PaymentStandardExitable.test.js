const PaymentStandardExitable = artifacts.require('PaymentStandardExitable');
const DummyPlasmaFramework = artifacts.require('DummyPlasmaFramework');
const DummyVault = artifacts.require('DummyVault');
const ExitId = artifacts.require('ExitIdWrapper');
const IsDeposit = artifacts.require('IsDepositWrapper');
const ExitableTimestamp = artifacts.require('ExitableTimestampWrapper');

const { BN, constants, expectRevert, time } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { MerkleTree } = require('../../../helpers/merkle.js');
const { spentOnGas } = require('../../../helpers/utils.js');
const Testlang = require('../../../helpers/testlang.js');


contract('PaymentStandardExitable', ([_, alice, bob]) => {
    const STANDARD_EXIT_BOND = 31415926535; // wei
    const ETH = constants.ZERO_ADDRESS;
    const CHILD_BLOCK_INTERVAL = 1000;
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week

    const buildTestData = (amount, blockNum) => {
        const tx = Testlang.deposit(amount, alice, ETH);
        const utxoPos = Testlang.buildUtxoPos(blockNum, 0, 0);
        const merkleTree = new MerkleTree([tx], 3);
        const merkleProof = merkleTree.getInclusionProof(tx);

        return {
            utxoPos, tx, merkleTree, merkleProof,
        };
    };

    describe('startStandardExit', () => {
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
            const dummyBlockNum = 1000;
            const data = buildTestData(testAmount, dummyBlockNum);
            const fakeRoot = web3.utils.sha3('fake root data');

            await this.framework.setBlock(dummyBlockNum, fakeRoot, 0);

            await expectRevert(
                this.exitGame.startStandardExit(
                    data.utxoPos, data.tx, data.merkleProof,
                    { from: alice, value: STANDARD_EXIT_BOND },
                ),
                'transaction inclusion proof failed',
            );
        });

        it('should fail when exit with amount of 0', async () => {
            const testAmount = 0;
            const dummyBlockNum = 1000;
            const data = buildTestData(testAmount, dummyBlockNum);

            await this.framework.setBlock(dummyBlockNum, data.merkleTree.root, 0);

            await expectRevert(
                this.exitGame.startStandardExit(
                    data.utxoPos, data.tx, data.merkleProof,
                    { from: alice, value: STANDARD_EXIT_BOND },
                ),
                'Should not exit with amount 0',
            );
        });

        it('should fail when amount of bond is invalid', async () => {
            const testAmount = 1000;
            const dummyBlockNum = 1000;
            const data = buildTestData(testAmount, dummyBlockNum);

            await this.framework.setBlock(dummyBlockNum, data.merkleTree.root, 0);

            const invalidBond = STANDARD_EXIT_BOND - 100;
            await expectRevert(
                this.exitGame.startStandardExit(
                    data.utxoPos, data.tx, data.merkleProof,
                    { from: alice, value: invalidBond },
                ),
                'Input value mismatches with msg.value',
            );
        });

        it('should fail when not initiated by the output owner', async () => {
            const testAmount = 1000;
            const dummyBlockNum = 1000;
            const data = buildTestData(testAmount, dummyBlockNum);

            await this.framework.setBlock(dummyBlockNum, data.merkleTree.root, 0);

            const nonOutputOwner = bob;
            await expectRevert(
                this.exitGame.startStandardExit(
                    data.utxoPos, data.tx, data.merkleProof,
                    { from: nonOutputOwner, value: STANDARD_EXIT_BOND },
                ),
                'Only output owner can start an exit',
            );
        });

        it('should fail when same exit already started', async () => {
            const testAmount = 1000;
            const dummyBlockNum = 1000;
            const data = buildTestData(testAmount, dummyBlockNum);

            await this.framework.setBlock(dummyBlockNum, data.merkleTree.root, 0);

            await this.exitGame.startStandardExit(
                data.utxoPos, data.tx, data.merkleProof,
                { from: alice, value: STANDARD_EXIT_BOND },
            );

            await expectRevert(
                this.exitGame.startStandardExit(
                    data.utxoPos, data.tx, data.merkleProof,
                    { from: alice, value: STANDARD_EXIT_BOND },
                ),
                'Exit already started',
            );
        });

        it('should charge the bond for the user', async () => {
            const testAmount = 1000;
            const dummyBlockNum = 1000;
            const data = buildTestData(testAmount, dummyBlockNum);

            await this.framework.setBlock(dummyBlockNum, data.merkleTree.root, 0);

            const preBalance = new BN(await web3.eth.getBalance(alice));
            const tx = await this.exitGame.startStandardExit(
                data.utxoPos, data.tx, data.merkleProof,
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
            const dummyBlockNum = 1000;
            const data = buildTestData(testAmount, dummyBlockNum);

            await this.framework.setBlock(dummyBlockNum, data.merkleTree.root, 0);

            await this.exitGame.startStandardExit(
                data.utxoPos, data.tx, data.merkleProof,
                { from: alice, value: STANDARD_EXIT_BOND },
            );

            const isTxDeposit = await this.isDeposit.test(dummyBlockNum);
            const exitId = await this.exitIdHelper.getStandardExitId(isTxDeposit, data.tx, data.utxoPos);

            const standardExitData = await this.exitGame.exits(exitId);

            expect(standardExitData.exitable).to.be.true;
            expect(standardExitData.position).to.be.bignumber.equal(new BN(data.utxoPos));
            expect(standardExitData.exitTarget).to.equal(alice);
            expect(standardExitData.token).to.equal(ETH);
            expect(standardExitData.amount).to.be.bignumber.equal(new BN(testAmount));
        });

        it('should put the exit data into the queue of framework', async () => {
            const testAmount = 1000;
            const dummyBlockNum = 1000;
            const data = buildTestData(testAmount, dummyBlockNum);
            const currentTimestamp = await time.latest();
            const timestamp = currentTimestamp.sub(new BN(15));

            await this.framework.setBlock(dummyBlockNum, data.merkleTree.root, timestamp);

            await this.exitGame.startStandardExit(
                data.utxoPos, data.tx, data.merkleProof,
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
    });
});
