const ExitableTimestamp = artifacts.require('ExitableTimestampWrapper');
const ExitId = artifacts.require('ExitIdWrapper');
const ExpectedOutputGuardHandler = artifacts.require('ExpectedOutputGuardHandler');
const IsDeposit = artifacts.require('IsDepositWrapper');
const OutputGuardHandlerRegistry = artifacts.require('OutputGuardHandlerRegistry');
const PaymentChallengeStandardExit = artifacts.require('PaymentChallengeStandardExit');
const PaymentProcessStandardExit = artifacts.require('PaymentProcessStandardExit');
const PaymentStandardExitRouter = artifacts.require('PaymentStandardExitRouterMock');
const PaymentStartStandardExit = artifacts.require('PaymentStartStandardExit');
const PaymentSpendingConditionRegistry = artifacts.require('PaymentSpendingConditionRegistry');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { OUTPUT_TYPE } = require('../../../helpers/constants.js');
const { MerkleTree } = require('../../../helpers/merkle.js');
const { buildUtxoPos, utxoPosToTxPos } = require('../../../helpers/positions.js');
const {
    computeDepositOutputId,
    computeNormalOutputId, spentOnGas,
} = require('../../../helpers/utils.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../../../helpers/transaction.js');


contract('PaymentStandardExitRouter', ([_, outputOwner, nonOutputOwner]) => {
    const ETH = constants.ZERO_ADDRESS;
    const CHILD_BLOCK_INTERVAL = 1000;
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week in seconds
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const EMPTY_BYTES = '0x0000000000000000000000000000000000000000000000000000000000000000000000';

    before('deploy and link with controller lib', async () => {
        const startStandardExit = await PaymentStartStandardExit.new();
        const challengeStandardExit = await PaymentChallengeStandardExit.new();
        const processStandardExit = await PaymentProcessStandardExit.new();

        await PaymentStandardExitRouter.link('PaymentStartStandardExit', startStandardExit.address);
        await PaymentStandardExitRouter.link('PaymentChallengeStandardExit', challengeStandardExit.address);
        await PaymentStandardExitRouter.link('PaymentProcessStandardExit', processStandardExit.address);
    });

    describe('startStandardExit', () => {
        const buildTestData = (
            amount, owner, blockNum,
            outputType = OUTPUT_TYPE.PAYMENT,
            outputGuardPreimage = EMPTY_BYTES,
        ) => {
            const output = new PaymentTransactionOutput(amount, owner, ETH);
            const txObj = new PaymentTransaction(1, [0], [output]);
            const tx = web3.utils.bytesToHex(txObj.rlpEncoded());

            const outputIndex = 0;
            const utxoPos = buildUtxoPos(blockNum, 0, outputIndex);
            const merkleTree = new MerkleTree([tx], 3);
            const merkleProof = merkleTree.getInclusionProof(tx);

            const args = {
                utxoPos,
                rlpOutputTx: tx,
                outputType,
                outputGuardPreimage,
                outputTxInclusionProof: merkleProof,
            };

            return {
                args, outputIndex, merkleTree,
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
            const spendingConditionRegistry = await PaymentSpendingConditionRegistry.new();
            this.outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();

            const handler = await ExpectedOutputGuardHandler.new();
            await handler.mockIsValid(true);
            await handler.mockGetExitTarget(outputOwner);
            await this.outputGuardHandlerRegistry.registerOutputGuardHandler(OUTPUT_TYPE.PAYMENT, handler.address);

            this.exitGame = await PaymentStandardExitRouter.new(
                this.framework.address, ethVault.address, erc20Vault.address,
                this.outputGuardHandlerRegistry.address, spendingConditionRegistry.address,
            );

            this.startStandardExitBondSize = await this.exitGame.startStandardExitBondSize();
        });

        it('should fail when the transaction is not standard finalized', async () => {
            const { args } = buildTestData(this.dummyAmount, outputOwner, this.dummyBlockNum);
            const fakeRoot = web3.utils.sha3('fake root data');

            await this.framework.setBlock(this.dummyBlockNum, fakeRoot, 0);

            await expectRevert(
                this.exitGame.startStandardExit(
                    args, { from: outputOwner, value: this.startStandardExitBondSize },
                ),
                'The transaction must be standard finalized',
            );
        });

        it('should fail when exit with amount of 0', async () => {
            const testAmountZero = 0;
            const { args, merkleTree } = buildTestData(testAmountZero, outputOwner, this.dummyBlockNum);

            await this.framework.setBlock(this.dummyBlockNum, merkleTree.root, 0);

            await expectRevert(
                this.exitGame.startStandardExit(
                    args, { from: outputOwner, value: this.startStandardExitBondSize },
                ),
                'Should not exit with amount 0',
            );
        });

        it('should fail when amount of bond is invalid', async () => {
            const { args, merkleTree } = buildTestData(this.dummyAmount, outputOwner, this.dummyBlockNum);

            await this.framework.setBlock(this.dummyBlockNum, merkleTree.root, 0);

            const invalidBond = this.startStandardExitBondSize.subn(100);
            await expectRevert(
                this.exitGame.startStandardExit(
                    args, { from: outputOwner, value: invalidBond },
                ),
                'Input value mismatches with msg.value',
            );
        });

        it('should fail when output guard handler is not registered with the output type', async () => {
            const nonRegisteredOutputType = 2;

            const { args, merkleTree } = buildTestData(
                this.dummyAmount, outputOwner, this.dummyBlockNum, nonRegisteredOutputType,
            );

            await this.framework.setBlock(this.dummyBlockNum, merkleTree.root, 0);

            await expectRevert(
                this.exitGame.startStandardExit(
                    args, { from: outputOwner, value: this.startStandardExitBondSize },
                ),
                'Failed to get the output guard handler for the output type',
            );
        });

        it('should fail when some of the output guard information (guard, output type, pre-image) is not valid', async () => {
            // register with handler that returns false when checking output guard information
            const expectedValid = false;
            const testOutputType = 2;
            const handler = await ExpectedOutputGuardHandler.new(expectedValid, outputOwner);
            await this.outputGuardHandlerRegistry.registerOutputGuardHandler(testOutputType, handler.address);

            const { args, merkleTree } = buildTestData(
                this.dummyAmount, outputOwner, this.dummyBlockNum, testOutputType,
            );

            await this.framework.setBlock(this.dummyBlockNum, merkleTree.root, 0);

            await expectRevert(
                this.exitGame.startStandardExit(
                    args, { from: outputOwner, value: this.startStandardExitBondSize },
                ),
                'Some of the output guard related information is not valid',
            );
        });

        it('should fail when not initiated by the exit target', async () => {
            const { args, merkleTree } = buildTestData(this.dummyAmount, outputOwner, this.dummyBlockNum);

            await this.framework.setBlock(this.dummyBlockNum, merkleTree.root, 0);

            await expectRevert(
                this.exitGame.startStandardExit(
                    args, { from: nonOutputOwner, value: this.startStandardExitBondSize },
                ),
                'Only exit target can start an exit',
            );
        });

        it('should fail when same exit already started', async () => {
            const { args, merkleTree } = buildTestData(this.dummyAmount, outputOwner, this.dummyBlockNum);

            await this.framework.setBlock(this.dummyBlockNum, merkleTree.root, 0);

            await this.exitGame.startStandardExit(
                args, { from: outputOwner, value: this.startStandardExitBondSize },
            );

            await expectRevert(
                this.exitGame.startStandardExit(
                    args, { from: outputOwner, value: this.startStandardExitBondSize },
                ),
                'Exit already started',
            );
        });

        it('should charge the bond from the user', async () => {
            const { args, merkleTree } = buildTestData(this.dummyAmount, outputOwner, this.dummyBlockNum);

            await this.framework.setBlock(this.dummyBlockNum, merkleTree.root, 0);

            const preBalance = new BN(await web3.eth.getBalance(outputOwner));
            const tx = await this.exitGame.startStandardExit(
                args, { from: outputOwner, value: this.startStandardExitBondSize },
            );
            const actualPostBalance = new BN(await web3.eth.getBalance(outputOwner));
            const expectedPostBalance = preBalance
                .sub(this.startStandardExitBondSize)
                .sub(await spentOnGas(tx.receipt));

            expect(actualPostBalance).to.be.bignumber.equal(expectedPostBalance);
        });

        it('should save the correct StandardExit data when successfully done for deposit tx', async () => {
            const depositBlockNum = 2019;
            const { args, merkleTree, outputIndex } = buildTestData(this.dummyAmount, outputOwner, depositBlockNum);

            await this.framework.setBlock(depositBlockNum, merkleTree.root, 0);

            await this.exitGame.startStandardExit(
                args, { from: outputOwner, value: this.startStandardExitBondSize },
            );

            const isTxDeposit = true;
            const exitId = await this.exitIdHelper.getStandardExitId(isTxDeposit, args.rlpOutputTx, args.utxoPos);
            const outputId = computeDepositOutputId(args.rlpOutputTx, outputIndex, args.utxoPos);

            const standardExitData = await this.exitGame.standardExits(exitId);

            expect(standardExitData.exitable).to.be.true;
            expect(new BN(standardExitData.utxoPos)).to.be.bignumber.equal(new BN(args.utxoPos));
            expect(standardExitData.outputId).to.equal(outputId);
            expect(standardExitData.exitTarget).to.equal(outputOwner);
            expect(standardExitData.token).to.equal(ETH);
            expect(new BN(standardExitData.amount)).to.be.bignumber.equal(new BN(this.dummyAmount));
        });

        it('should save the correct StandardExit data when successfully done for non deposit tx', async () => {
            const nonDepositBlockNum = 1000;
            const { args, outputIndex, merkleTree } = buildTestData(this.dummyAmount, outputOwner, nonDepositBlockNum);

            await this.framework.setBlock(nonDepositBlockNum, merkleTree.root, 0);

            await this.exitGame.startStandardExit(
                args, { from: outputOwner, value: this.startStandardExitBondSize },
            );

            const isTxDeposit = false;
            const exitId = await this.exitIdHelper.getStandardExitId(isTxDeposit, args.rlpOutputTx, args.utxoPos);
            const outputId = computeNormalOutputId(args.rlpOutputTx, outputIndex);

            const standardExitData = await this.exitGame.standardExits(exitId);

            expect(standardExitData.exitable).to.be.true;
            expect(new BN(standardExitData.utxoPos)).to.be.bignumber.equal(new BN(args.utxoPos));
            expect(standardExitData.outputId).to.equal(outputId);
            expect(standardExitData.exitTarget).to.equal(outputOwner);
            expect(standardExitData.token).to.equal(ETH);
            expect(new BN(standardExitData.amount)).to.be.bignumber.equal(new BN(this.dummyAmount));
        });

        it('should put the exit data into the queue of framework', async () => {
            const { args, merkleTree } = buildTestData(this.dummyAmount, outputOwner, this.dummyBlockNum);

            await this.framework.setBlock(this.dummyBlockNum, merkleTree.root, 0);

            const { receipt } = await this.exitGame.startStandardExit(
                args, { from: outputOwner, value: this.startStandardExitBondSize },
            );

            const isTxDeposit = await this.isDeposit.test(this.dummyBlockNum);
            const exitId = await this.exitIdHelper.getStandardExitId(isTxDeposit, args.rlpOutputTx, args.utxoPos);

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
                    txPos: new BN(utxoPosToTxPos(args.utxoPos)),
                    exitProcessor: this.exitGame.address,
                    exitId,
                },
            );
        });

        it('should emit ExitStarted event', async () => {
            const { args, merkleTree } = buildTestData(this.dummyAmount, outputOwner, this.dummyBlockNum);

            await this.framework.setBlock(this.dummyBlockNum, merkleTree.root, 0);

            const isTxDeposit = await this.isDeposit.test(this.dummyBlockNum);
            const exitId = await this.exitIdHelper.getStandardExitId(isTxDeposit, args.rlpOutputTx, args.utxoPos);
            const { receipt } = await this.exitGame.startStandardExit(
                args, { from: outputOwner, value: this.startStandardExitBondSize },
            );

            await expectEvent.inTransaction(
                receipt.transactionHash,
                PaymentStartStandardExit,
                'ExitStarted',
                { owner: outputOwner, exitId },
            );
        });
    });
});
