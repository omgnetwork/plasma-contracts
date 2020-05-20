const ExitableTimestamp = artifacts.require('ExitableTimestampWrapper');
const ExitId = artifacts.require('ExitIdWrapper');
const PaymentChallengeStandardExit = artifacts.require('PaymentChallengeStandardExit');
const PaymentProcessStandardExit = artifacts.require('PaymentProcessStandardExit');
const PaymentStandardExitRouter = artifacts.require('PaymentStandardExitRouterMock');
const PaymentStartStandardExit = artifacts.require('PaymentStartStandardExit');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');
const StateTransitionVerifierMock = artifacts.require('StateTransitionVerifierMock');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const {
    OUTPUT_TYPE, PROTOCOL, TX_TYPE, VAULT_ID, DUMMY_INPUT_1, SAFE_GAS_STIPEND,
} = require('../../../../helpers/constants.js');
const { MerkleTree } = require('../../../../helpers/merkle.js');
const { buildUtxoPos, txPostionForExitPriority } = require('../../../../helpers/positions.js');
const {
    computeDepositOutputId,
    computeNormalOutputId, spentOnGas,
} = require('../../../../helpers/utils.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../../../../helpers/transaction.js');


contract('PaymentStartStandardExit', ([_, outputOwner, nonOutputOwner]) => {
    const ETH = constants.ZERO_ADDRESS;
    const CHILD_BLOCK_INTERVAL = 1000;
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week in seconds
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;

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
            txType = TX_TYPE.PAYMENT,
            outputType = OUTPUT_TYPE.PAYMENT,
        ) => {
            const output = new PaymentTransactionOutput(outputType, amount, owner, ETH);
            const txObj = new PaymentTransaction(txType, [DUMMY_INPUT_1], [output]);
            const tx = web3.utils.bytesToHex(txObj.rlpEncoded());

            const outputIndex = 0;
            const utxoPos = buildUtxoPos(blockNum, 0, outputIndex);
            const merkleTree = new MerkleTree([tx], 3);
            const merkleProof = merkleTree.getInclusionProof(tx);

            const args = {
                utxoPos,
                rlpOutputTx: tx,
                outputTxInclusionProof: merkleProof,
            };

            return {
                args, outputIndex, merkleTree,
            };
        };

        const buildTestData2 = (
            outputs,
            blockNum,
            txType = TX_TYPE.PAYMENT,
        ) => {
            const txObj = new PaymentTransaction(txType, [DUMMY_INPUT_1], outputs);
            const tx = web3.utils.bytesToHex(txObj.rlpEncoded());

            const merkleTree = new MerkleTree([tx], 3);
            const merkleProof = merkleTree.getInclusionProof(tx);

            const args = outputs.map((output, i) => ({
                utxoPos: buildUtxoPos(blockNum, 0, i),
                rlpOutputTx: tx,
                outputTxInclusionProof: merkleProof,
            }));

            return {
                args, merkleTree,
            };
        };

        before(async () => {
            this.exitIdHelper = await ExitId.new();
            this.exitableHelper = await ExitableTimestamp.new(MIN_EXIT_PERIOD);

            this.dummyAmount = 1000;
            this.dummyBlockNum = 1001;
            this.dummyBlockTimestamp = await time.latest();
        });

        beforeEach(async () => {
            this.framework = await SpyPlasmaFramework.new(
                MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
            );

            const ethVault = await SpyEthVault.new(this.framework.address);
            const erc20Vault = await SpyErc20Vault.new(this.framework.address);

            await this.framework.registerVault(VAULT_ID.ETH, ethVault.address);
            await this.framework.registerVault(VAULT_ID.ERC20, erc20Vault.address);

            const spendingConditionRegistry = await SpendingConditionRegistry.new();

            const stateTransitionVerifier = await StateTransitionVerifierMock.new();

            const exitGameArgs = [
                this.framework.address,
                VAULT_ID.ETH,
                VAULT_ID.ERC20,
                spendingConditionRegistry.address,
                stateTransitionVerifier.address,
                TX_TYPE.PAYMENT,
                SAFE_GAS_STIPEND,
            ];
            this.exitGame = await PaymentStandardExitRouter.new(exitGameArgs);

            await this.framework.registerExitGame(TX_TYPE.PAYMENT, this.exitGame.address, PROTOCOL.MORE_VP);

            this.startStandardExitBondSize = await this.exitGame.startStandardExitBondSize();
        });

        it('should fail when the transaction is not standard finalized', async () => {
            const { args } = buildTestData(this.dummyAmount, outputOwner, this.dummyBlockNum);
            const fakeRoot = web3.utils.sha3('fake root data');

            await this.framework.setBlock(this.dummyBlockNum, fakeRoot, this.dummyBlockTimestamp);

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

            await this.framework.setBlock(this.dummyBlockNum, merkleTree.root, this.dummyBlockTimestamp);

            await expectRevert(
                this.exitGame.startStandardExit(
                    args, { from: outputOwner, value: this.startStandardExitBondSize },
                ),
                'Output amount must not be 0',
            );
        });

        it('should fail when the exiting tx type is not the supported one', async () => {
            const nonSupportedTxType = TX_TYPE.PAYMENT + 1;

            const { args, merkleTree } = buildTestData(
                this.dummyAmount, outputOwner, this.dummyBlockNum, nonSupportedTxType,
            );

            await this.framework.setBlock(this.dummyBlockNum, merkleTree.root, this.dummyBlockTimestamp);

            await expectRevert(
                this.exitGame.startStandardExit(
                    args, { from: outputOwner, value: this.startStandardExitBondSize },
                ),
                'Unsupported transaction type of the exit game',
            );
        });

        it('should fail when the block of the position does not exists in the Plasma Framework', async () => {
            const { args } = buildTestData(this.dummyAmount, outputOwner, this.dummyBlockNum);
            // test by not stubbing the block data accordingly
            await expectRevert(
                this.exitGame.startStandardExit(
                    args, { from: outputOwner, value: this.startStandardExitBondSize },
                ),
                'There is no block for the position',
            );
        });

        it('should fail when amount of bond is invalid', async () => {
            const { args, merkleTree } = buildTestData(this.dummyAmount, outputOwner, this.dummyBlockNum);

            await this.framework.setBlock(this.dummyBlockNum, merkleTree.root, this.dummyBlockTimestamp);

            const invalidBond = this.startStandardExitBondSize.subn(100);
            await expectRevert(
                this.exitGame.startStandardExit(
                    args, { from: outputOwner, value: invalidBond },
                ),
                'Input value must match msg.value',
            );
        });

        it('should fail when not initiated by the output owner', async () => {
            const { args, merkleTree } = buildTestData(this.dummyAmount, outputOwner, this.dummyBlockNum);

            await this.framework.setBlock(this.dummyBlockNum, merkleTree.root, this.dummyBlockTimestamp);

            await expectRevert(
                this.exitGame.startStandardExit(
                    args, { from: nonOutputOwner, value: this.startStandardExitBondSize },
                ),
                'Only output owner can start an exit',
            );
        });

        it('should fail when same Exit has already started', async () => {
            const { args, merkleTree } = buildTestData(this.dummyAmount, outputOwner, this.dummyBlockNum);

            await this.framework.setBlock(this.dummyBlockNum, merkleTree.root, this.dummyBlockTimestamp);

            await this.exitGame.startStandardExit(
                args, { from: outputOwner, value: this.startStandardExitBondSize },
            );

            await expectRevert(
                this.exitGame.startStandardExit(
                    args, { from: outputOwner, value: this.startStandardExitBondSize },
                ),
                'Exit has already started',
            );
        });

        it('should fail when exit has already been spent', async () => {
            const { args, merkleTree } = buildTestData(this.dummyAmount, outputOwner, this.dummyBlockNum);

            const outputId = computeDepositOutputId(args.rlpOutputTx, 0, args.utxoPos);
            await this.framework.setOutputFinalized(outputId, 1);
            await this.framework.setBlock(this.dummyBlockNum, merkleTree.root, this.dummyBlockTimestamp);

            await expectRevert(
                this.exitGame.startStandardExit(
                    args, { from: outputOwner, value: this.startStandardExitBondSize },
                ),
                'Output is already spent',
            );
        });

        it('should charge the bond from the user', async () => {
            const { args, merkleTree } = buildTestData(this.dummyAmount, outputOwner, this.dummyBlockNum);

            await this.framework.setBlock(this.dummyBlockNum, merkleTree.root, this.dummyBlockTimestamp);

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

            await this.framework.setBlock(depositBlockNum, merkleTree.root, this.dummyBlockTimestamp);

            await this.exitGame.startStandardExit(
                args, { from: outputOwner, value: this.startStandardExitBondSize },
            );

            const isTxDeposit = true;
            const exitId = await this.exitIdHelper.getStandardExitId(isTxDeposit, args.rlpOutputTx, args.utxoPos);
            const outputId = computeDepositOutputId(args.rlpOutputTx, outputIndex, args.utxoPos);

            const standardExitData = (await this.exitGame.standardExits([exitId]))[0];

            expect(standardExitData.exitable).to.be.true;
            expect(new BN(standardExitData.utxoPos)).to.be.bignumber.equal(new BN(args.utxoPos));
            expect(standardExitData.outputId).to.equal(outputId);
            expect(standardExitData.exitTarget).to.equal(outputOwner);
            expect(new BN(standardExitData.amount)).to.be.bignumber.equal(new BN(this.dummyAmount));
        });

        it('should save the correct StandardExit data when successfully done for non deposit tx', async () => {
            const nonDepositBlockNum = 1000;
            const { args, outputIndex, merkleTree } = buildTestData(this.dummyAmount, outputOwner, nonDepositBlockNum);

            await this.framework.setBlock(nonDepositBlockNum, merkleTree.root, this.dummyBlockTimestamp);

            await this.exitGame.startStandardExit(
                args, { from: outputOwner, value: this.startStandardExitBondSize },
            );

            const isTxDeposit = false;
            const exitId = await this.exitIdHelper.getStandardExitId(isTxDeposit, args.rlpOutputTx, args.utxoPos);
            const outputId = computeNormalOutputId(args.rlpOutputTx, outputIndex);

            const standardExitData = (await this.exitGame.standardExits([exitId]))[0];

            expect(standardExitData.exitable).to.be.true;
            expect(new BN(standardExitData.utxoPos)).to.be.bignumber.equal(new BN(args.utxoPos));
            expect(standardExitData.outputId).to.equal(outputId);
            expect(standardExitData.exitTarget).to.equal(outputOwner);
            expect(new BN(standardExitData.amount)).to.be.bignumber.equal(new BN(this.dummyAmount));
        });

        it('should put the exit data into the queue of framework', async () => {
            const { args, merkleTree } = buildTestData(this.dummyAmount, outputOwner, this.dummyBlockNum);

            await this.framework.setBlock(this.dummyBlockNum, merkleTree.root, this.dummyBlockTimestamp);

            const { receipt } = await this.exitGame.startStandardExit(
                args, { from: outputOwner, value: this.startStandardExitBondSize },
            );

            const isTxDeposit = await this.framework.isDeposit(this.dummyBlockNum);
            const exitId = await this.exitIdHelper.getStandardExitId(isTxDeposit, args.rlpOutputTx, args.utxoPos);

            const currentTimestamp = await time.latest();
            const exitableAt = await this.exitableHelper.calculateDepositTxOutputExitableTimestamp(currentTimestamp);

            await expectEvent.inTransaction(
                receipt.transactionHash,
                SpyPlasmaFramework,
                'EnqueueTriggered',
                {
                    token: ETH,
                    exitableAt,
                    txPos: new BN(txPostionForExitPriority(args.utxoPos)),
                    exitProcessor: this.exitGame.address,
                    exitId,
                },
            );
        });

        it('should emit ExitStarted event', async () => {
            const { args, merkleTree } = buildTestData(this.dummyAmount, outputOwner, this.dummyBlockNum);

            await this.framework.setBlock(this.dummyBlockNum, merkleTree.root, this.dummyBlockTimestamp);

            const isTxDeposit = await this.framework.isDeposit(this.dummyBlockNum);
            const exitId = await this.exitIdHelper.getStandardExitId(isTxDeposit, args.rlpOutputTx, args.utxoPos);
            const { logs } = await this.exitGame.startStandardExit(
                args, { from: outputOwner, value: this.startStandardExitBondSize },
            );

            await expectEvent.inLogs(
                logs,
                'ExitStarted',
                { owner: outputOwner, exitId },
            );
        });

        it('should allow 2 outputs on the same transaction to exit', async () => {
            const BLOCK_NUM = 2000;
            const { args, merkleTree } = buildTestData2(
                [
                    new PaymentTransactionOutput(OUTPUT_TYPE.PAYMENT, this.dummyAmount, outputOwner, ETH),
                    new PaymentTransactionOutput(OUTPUT_TYPE.PAYMENT, this.dummyAmount, outputOwner, ETH),
                ],
                BLOCK_NUM,
            );

            await this.framework.setBlock(BLOCK_NUM, merkleTree.root, this.dummyBlockTimestamp);

            const isTxDeposit = await this.framework.isDeposit(BLOCK_NUM);

            const { logs: logs1 } = await this.exitGame.startStandardExit(
                args[0], { from: outputOwner, value: this.startStandardExitBondSize },
            );
            const exitId1 = await this.exitIdHelper.getStandardExitId(
                isTxDeposit, args[0].rlpOutputTx, args[0].utxoPos,
            );
            await expectEvent.inLogs(
                logs1,
                'ExitStarted',
                { owner: outputOwner, exitId: exitId1 },
            );

            const { logs: logs2 } = await this.exitGame.startStandardExit(
                args[1], { from: outputOwner, value: this.startStandardExitBondSize },
            );
            const exitId2 = await this.exitIdHelper.getStandardExitId(
                isTxDeposit, args[1].rlpOutputTx, args[1].utxoPos,
            );
            await expectEvent.inLogs(
                logs2,
                'ExitStarted',
                { owner: outputOwner, exitId: exitId2 },
            );
        });
    });
});
