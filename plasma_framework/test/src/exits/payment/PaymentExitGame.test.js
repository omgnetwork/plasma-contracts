const PaymentExitGame = artifacts.require('PaymentExitGame');
const PlasmaFramework = artifacts.require('PlasmaFramework');
const PriorityQueue = artifacts.require('PriorityQueue');
const EthVault = artifacts.require('EthVault');
const EthDepositVerifier = artifacts.require('EthDepositVerifier');
const ExitId = artifacts.require('ExitIdWrapper');

const { BN, constants } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { MerkleTree } = require('../../../helpers/merkle.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../../../helpers/transaction.js');
const Testlang = require('../../../helpers/testlang.js');

contract('PaymentExitGame - End to End Tests', ([_, alice, bob]) => {
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week
    const STANDARD_EXIT_BOND = 31415926535; // wei
    const ETH = constants.ZERO_ADDRESS;
    const DEPOSIT_VALUE = 1000000;

    const setupContracts = async () => {
        this.framework = await PlasmaFramework.new(MIN_EXIT_PERIOD);
        this.exitGame = await PaymentExitGame.new(this.framework.address);
        this.ethVault = await EthVault.new(this.framework.address);
        this.exitIdHelper = await ExitId.new();

        const depositVerifier = await EthDepositVerifier.new();
        await this.ethVault.setDepositVerifier(depositVerifier.address);
        await this.framework.registerVault(1, this.ethVault.address);
        await this.framework.registerExitGame(1, this.exitGame.address);
    };

    const aliceDeposits = async () => {
        const depositBlockNum = (await this.framework.nextDepositBlock()).toNumber();
        this.depositUtxoPos = Testlang.buildUtxoPos(depositBlockNum, 0, 0);
        this.depositTx = Testlang.deposit(DEPOSIT_VALUE, alice);
        this.merkleTreeForDepositTx = new MerkleTree([this.depositTx], 16);
        this.merkleProofForDepositTx = this.merkleTreeForDepositTx.getInclusionProof(this.depositTx);

        await this.ethVault.deposit(this.depositTx, { from: alice, value: DEPOSIT_VALUE });
    };

    const aliceTransferToBob = async () => {
        const tranferTxBlockNum = (await this.framework.nextChildBlock()).toNumber();
        this.transferUtxoPos = Testlang.buildUtxoPos(tranferTxBlockNum, 0, 0);

        const output = new PaymentTransactionOutput(1000, bob, ETH);

        // TODO: utxo_pos or output_id pending decision here: https://github.com/omisego/research/issues/93
        // if it ends up differently should alter this function accordingly
        this.transferTx = (new PaymentTransaction(1, [this.transferUtxoPos], [output])).rlpEncoded();
        this.merkleTreeForTransferTx = new MerkleTree([this.transferTx]);
        this.merkleProofForTransferTx = this.merkleTreeForTransferTx.getInclusionProof(this.transferTx);

        await this.framework.submitBlock(this.merkleTreeForTransferTx.root);
    };

    describe('Given contracts deployed, exit game and ETH vault registered', () => {
        beforeEach(setupContracts);

        describe('Given alice deposited', () => {
            beforeEach(aliceDeposits);

            describe('When alice starts standard exit on the deposit tx', () => {
                beforeEach(async () => {
                    await this.exitGame.startStandardExit(
                        this.depositUtxoPos, this.depositTx, this.merkleProofForDepositTx,
                        { from: alice, value: STANDARD_EXIT_BOND },
                    );
                });

                it('should save the StandardExit data when successfully done', async () => {
                    const exitId = await this.exitIdHelper.getStandardExitId(true, this.depositTx, this.depositUtxoPos);
                    const standardExitData = await this.exitGame.exits(exitId);

                    expect(standardExitData.exitable).to.be.true;
                    expect(standardExitData.position).to.be.bignumber.equal(new BN(this.depositUtxoPos));
                    expect(standardExitData.token).to.equal(ETH);
                    expect(standardExitData.exitTarget).to.equal(alice);
                    expect(standardExitData.amount).to.be.bignumber.equal(new BN(DEPOSIT_VALUE));
                });

                it('should put the exit data into the queue of framework', async () => {
                    const priorityQueueAddress = await this.framework.exitsQueues(ETH);
                    const priorityQueue = await PriorityQueue.at(priorityQueueAddress);
                    const uniquePriority = await priorityQueue.getMin();

                    // right most 64 bits are nonce for priority queue
                    expect(uniquePriority.shrn(64)).to.be.bignumber.equal(new BN(this.depositUtxoPos));
                });
            });
        });

        describe('Given alice deposited and transfered to bob', () => {
            beforeEach(async () => {
                await aliceDeposits();
                await aliceTransferToBob();
            });

            describe('When bob tries to start the standard exit on the transfered tx', () => {
                beforeEach(async () => {
                    await this.exitGame.startStandardExit(
                        this.transferUtxoPos, this.transferTx, this.merkleProofForTransferTx,
                        { from: bob, value: STANDARD_EXIT_BOND },
                    );
                });

                it('should start successully', async () => {
                    const exitId = await this.exitIdHelper.getStandardExitId(
                        false, this.transferTx, this.transferUtxoPos,
                    );
                    const standardExitData = await this.exitGame.exits(exitId);
                    expect(standardExitData.exitable).to.be.true;
                });
            });
        });

        describe('Given alice deposited and transfered to bob', () => {
            beforeEach(async () => {
                await aliceDeposits();
                await aliceTransferToBob();
            });

            describe('When alice tries to start the standard exit on the deposit tx', () => {
                beforeEach(async () => {
                    await this.exitGame.startStandardExit(
                        this.depositUtxoPos, this.depositTx, this.merkleProofForDepositTx,
                        { from: alice, value: STANDARD_EXIT_BOND },
                    );
                });

                it('should still be able to start standard exit even already spent', async () => {
                    const exitId = await this.exitIdHelper.getStandardExitId(true, this.depositTx, this.depositUtxoPos);
                    const standardExitData = await this.exitGame.exits(exitId);
                    expect(standardExitData.exitable).to.be.true;
                });

                describe('Then bob can challenge the standard exit spent', async () => {
                    it('TODO: should challenge it successfully', async () => {
                        // TODO: implement this!
                        // this is to show case how we can do cool BDD style in E2E test and reuse setup
                    });
                });
            });
        });
    });
});
