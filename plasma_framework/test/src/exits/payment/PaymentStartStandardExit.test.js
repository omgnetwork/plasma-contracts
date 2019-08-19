const ExitableTimestamp = artifacts.require('ExitableTimestampWrapper');
const ExitId = artifacts.require('ExitIdWrapper');
const IsDeposit = artifacts.require('IsDepositWrapper');
const OutputGuardParser = artifacts.require('DummyOutputGuardParser');
const OutputGuardParserRegistry = artifacts.require('OutputGuardParserRegistry');
const PaymentStandardExitRouter = artifacts.require('PaymentStandardExitRouterMock');
const PaymentStartStandardExitController = artifacts.require('PaymentStartStandardExitController');
const PaymentSpendingConditionRegistry = artifacts.require('PaymentSpendingConditionRegistry');
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


contract('PaymentStartStandardExit', ([_, alice, bob]) => {
    const STANDARD_EXIT_BOND = 31415926535; // wei
    const ETH = constants.ZERO_ADDRESS;
    const CHILD_BLOCK_INTERVAL = 1000;
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const OUTPUT_TYPE_ZERO = 0;
    const EMPTY_BYTES = '0x0000000000000000000000000000000000000000000000000000000000000000000000';

    before('deploy and link with controller lib', async () => {
        const controller = await PaymentStartStandardExitController.new();
        await PaymentStandardExitRouter.link('PaymentStartStandardExitController', controller.address);
    });

    describe('startStandardExit', () => {
        const buildTestData = (
            amount, owner, blockNum,
            outputType = OUTPUT_TYPE_ZERO,
            outputGuardData = EMPTY_BYTES,
        ) => {
            const output = new PaymentTransactionOutput(amount, addressToOutputGuard(owner), ETH);
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
                outputGuardData,
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
            this.outputGuardParserRegistry = await OutputGuardParserRegistry.new();
            this.exitGame = await PaymentStandardExitRouter.new(
                this.framework.address, ethVault.address, erc20Vault.address,
                this.outputGuardParserRegistry.address, spendingConditionRegistry.address,
            );
        });

        it('should fail when cannot prove the tx is included in the block', async () => {
            const { args } = buildTestData(this.dummyAmount, alice, this.dummyBlockNum);
            const fakeRoot = web3.utils.sha3('fake root data');

            await this.framework.setBlock(this.dummyBlockNum, fakeRoot, 0);

            await expectRevert(
                this.exitGame.startStandardExit(
                    args, { from: alice, value: STANDARD_EXIT_BOND },
                ),
                'transaction inclusion proof failed',
            );
        });

        it('should fail when exit with amount of 0', async () => {
            const testAmountZero = 0;
            const { args, merkleTree } = buildTestData(testAmountZero, alice, this.dummyBlockNum);

            await this.framework.setBlock(this.dummyBlockNum, merkleTree.root, 0);

            await expectRevert(
                this.exitGame.startStandardExit(
                    args, { from: alice, value: STANDARD_EXIT_BOND },
                ),
                'Should not exit with amount 0',
            );
        });

        it('should fail when amount of bond is invalid', async () => {
            const { args, merkleTree } = buildTestData(this.dummyAmount, alice, this.dummyBlockNum);

            await this.framework.setBlock(this.dummyBlockNum, merkleTree.root, 0);

            const invalidBond = STANDARD_EXIT_BOND - 100;
            await expectRevert(
                this.exitGame.startStandardExit(
                    args, { from: alice, value: invalidBond },
                ),
                'Input value mismatches with msg.value',
            );
        });

        it('should fail when not initiated by the exit target', async () => {
            const { args, merkleTree } = buildTestData(this.dummyAmount, alice, this.dummyBlockNum);

            await this.framework.setBlock(this.dummyBlockNum, merkleTree.root, 0);

            const nonOutputOwner = bob;
            await expectRevert(
                this.exitGame.startStandardExit(
                    args, { from: nonOutputOwner, value: STANDARD_EXIT_BOND },
                ),
                'Only exit target can start an exit',
            );
        });

        it('should fail when output guard mismatches the pre-image data given output type non 0', async () => {
            const outputType = 1;
            const mismatchOutputguardData = '0x111111111111111';
            const { args, merkleTree } = buildTestData(
                this.dummyAmount, alice, this.dummyBlockNum,
                outputType, mismatchOutputguardData,
            );

            const outputGuardExitTarget = alice;
            const parser = await OutputGuardParser.new(outputGuardExitTarget);
            await this.outputGuardParserRegistry.registerOutputGuardParser(1, parser.address);

            await this.framework.setBlock(this.dummyBlockNum, merkleTree.root, 0);

            await expectRevert(
                this.exitGame.startStandardExit(
                    args, { from: alice, value: STANDARD_EXIT_BOND },
                ),
                'Output guard data does not match pre-image',
            );
        });

        it('should fail when output guard parser is not registered with the output type given output type non 0', async () => {
            const outputType = 1;
            const outputGuardData = web3.utils.toHex(alice);
            const outputGuard = buildOutputGuard(outputType, outputGuardData);

            const { args, merkleTree } = buildTestData(
                this.dummyAmount, outputGuard, this.dummyBlockNum,
                outputType, outputGuardData,
            );

            await this.framework.setBlock(this.dummyBlockNum, merkleTree.root, 0);

            await expectRevert(
                this.exitGame.startStandardExit(
                    args, { from: alice, value: STANDARD_EXIT_BOND },
                ),
                'Failed to get the output guard parser for the output type',
            );
        });

        it('should fail when same exit already started', async () => {
            const { args, merkleTree } = buildTestData(this.dummyAmount, alice, this.dummyBlockNum);

            await this.framework.setBlock(this.dummyBlockNum, merkleTree.root, 0);

            await this.exitGame.startStandardExit(
                args, { from: alice, value: STANDARD_EXIT_BOND },
            );

            await expectRevert(
                this.exitGame.startStandardExit(
                    args, { from: alice, value: STANDARD_EXIT_BOND },
                ),
                'Exit already started',
            );
        });

        it('should charge the bond from the user', async () => {
            const { args, merkleTree } = buildTestData(this.dummyAmount, alice, this.dummyBlockNum);

            await this.framework.setBlock(this.dummyBlockNum, merkleTree.root, 0);

            const preBalance = new BN(await web3.eth.getBalance(alice));
            const tx = await this.exitGame.startStandardExit(
                args, { from: alice, value: STANDARD_EXIT_BOND },
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
            const { args, merkleTree, outputIndex } = buildTestData(this.dummyAmount, alice, depositBlockNum);

            await this.framework.setBlock(depositBlockNum, merkleTree.root, 0);

            await this.exitGame.startStandardExit(
                args, { from: alice, value: STANDARD_EXIT_BOND },
            );

            const isTxDeposit = true;
            const exitId = await this.exitIdHelper.getStandardExitId(isTxDeposit, args.rlpOutputTx, args.utxoPos);
            const outputId = computeDepositOutputId(args.rlpOutputTx, outputIndex, args.utxoPos);

            const expectedOutputTypeAndGuardHash = web3.utils.soliditySha3(
                { t: 'uint256', v: OUTPUT_TYPE_ZERO }, { t: 'bytes32', v: addressToOutputGuard(outputOwner) },
            );

            const standardExitData = await this.exitGame.standardExits(exitId);

            expect(standardExitData.exitable).to.be.true;
            expect(new BN(standardExitData.utxoPos)).to.be.bignumber.equal(new BN(args.utxoPos));
            expect(standardExitData.outputId).to.equal(outputId);
            expect(standardExitData.outputTypeAndGuardHash).to.equal(expectedOutputTypeAndGuardHash);
            expect(standardExitData.exitTarget).to.equal(outputOwner);
            expect(standardExitData.token).to.equal(ETH);
            expect(new BN(standardExitData.amount)).to.be.bignumber.equal(new BN(this.dummyAmount));
        });

        it('should save the correct StandardExit data when successfully done for non deposit tx', async () => {
            const outputOwner = alice;
            const nonDepositBlockNum = 1000;
            const { args, outputIndex, merkleTree } = buildTestData(this.dummyAmount, alice, nonDepositBlockNum);

            await this.framework.setBlock(nonDepositBlockNum, merkleTree.root, 0);

            await this.exitGame.startStandardExit(
                args, { from: alice, value: STANDARD_EXIT_BOND },
            );

            const isTxDeposit = false;
            const exitId = await this.exitIdHelper.getStandardExitId(isTxDeposit, args.rlpOutputTx, args.utxoPos);
            const outputId = computeNormalOutputId(args.rlpOutputTx, outputIndex);

            const expectedOutputTypeAndGuardHash = web3.utils.soliditySha3(
                { t: 'uint256', v: OUTPUT_TYPE_ZERO }, { t: 'bytes32', v: addressToOutputGuard(outputOwner) },
            );

            const standardExitData = await this.exitGame.standardExits(exitId);

            expect(standardExitData.exitable).to.be.true;
            expect(new BN(standardExitData.utxoPos)).to.be.bignumber.equal(new BN(args.utxoPos));
            expect(standardExitData.outputId).to.equal(outputId);
            expect(standardExitData.outputTypeAndGuardHash).to.equal(expectedOutputTypeAndGuardHash);
            expect(standardExitData.exitTarget).to.equal(outputOwner);
            expect(standardExitData.token).to.equal(ETH);
            expect(new BN(standardExitData.amount)).to.be.bignumber.equal(new BN(this.dummyAmount));
        });

        it('should put the exit data into the queue of framework', async () => {
            const { args, merkleTree } = buildTestData(this.dummyAmount, alice, this.dummyBlockNum);

            await this.framework.setBlock(this.dummyBlockNum, merkleTree.root, 0);

            const { receipt } = await this.exitGame.startStandardExit(
                args, { from: alice, value: STANDARD_EXIT_BOND },
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
            const { args, merkleTree } = buildTestData(this.dummyAmount, alice, this.dummyBlockNum);

            await this.framework.setBlock(this.dummyBlockNum, merkleTree.root, 0);

            const isTxDeposit = await this.isDeposit.test(this.dummyBlockNum);
            const exitId = await this.exitIdHelper.getStandardExitId(isTxDeposit, args.rlpOutputTx, args.utxoPos);
            const { receipt } = await this.exitGame.startStandardExit(
                args, { from: alice, value: STANDARD_EXIT_BOND },
            );

            await expectEvent.inTransaction(
                receipt.transactionHash,
                PaymentStartStandardExitController,
                'ExitStarted',
                { owner: alice, exitId },
            );
        });
    });
});
