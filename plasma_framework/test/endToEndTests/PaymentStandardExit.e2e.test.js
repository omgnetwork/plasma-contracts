const EthVault = artifacts.require('EthVault');
const Erc20Vault = artifacts.require('Erc20Vault');
const ExitableTimestamp = artifacts.require('ExitableTimestampWrapper');
const ExitPriority = artifacts.require('ExitPriorityWrapper');
const ERC20Mintable = artifacts.require('ERC20Mintable');
const PaymentExitGame = artifacts.require('PaymentExitGame');
const PaymentProcessStandardExit = artifacts.require('PaymentProcessStandardExit');
const PlasmaFramework = artifacts.require('PlasmaFramework');
const PriorityQueue = artifacts.require('PriorityQueue');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { MerkleTree } = require('../helpers/merkle.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../helpers/transaction.js');
const {
    computeDepositOutputId, spentOnGas, exitQueueKey,
} = require('../helpers/utils.js');
const { sign } = require('../helpers/sign.js');
const { hashTx } = require('../helpers/paymentEip712.js');
const { buildUtxoPos, utxoPosToTxPos } = require('../helpers/positions.js');
const Testlang = require('../helpers/testlang.js');
const config = require('../../config.js');

contract('PaymentExitGame - Standard Exit - End to End Tests', ([_deployer, _maintainer, authority, bob, richFather]) => {
    const ETH = constants.ZERO_ADDRESS;
    const INITIAL_ERC20_SUPPLY = 10000000000;
    const DEPOSIT_VALUE = 1000000;
    const OUTPUT_TYPE_PAYMENT = config.registerKeys.outputTypes.payment;
    const MERKLE_TREE_DEPTH = 16;

    const alicePrivateKey = '0x7151e5dab6f8e95b5436515b83f423c4df64fe4c6149f864daa209b26adb10ca';
    let alice;

    const setupAccount = async () => {
        const password = 'password1234';
        alice = await web3.eth.personal.importRawKey(alicePrivateKey, password);
        alice = web3.utils.toChecksumAddress(alice);
        web3.eth.personal.unlockAccount(alice, password, 3600);
        web3.eth.sendTransaction({ to: alice, from: richFather, value: web3.utils.toWei('1', 'ether') });
    };

    const deployStableContracts = async () => {
        this.exitPriorityHelper = await ExitPriority.new();

        this.erc20 = await ERC20Mintable.new();
        await this.erc20.mint(richFather, INITIAL_ERC20_SUPPLY);
        this.exitableHelper = await ExitableTimestamp.new(config.frameworks.minExitPeriod);
    };

    before(async () => {
        await Promise.all([setupAccount(), deployStableContracts()]);
    });

    const setupContracts = async () => {
        this.framework = await PlasmaFramework.deployed();

        this.ethVault = await EthVault.at(await this.framework.vaults(config.registerKeys.vaultId.eth));
        this.erc20Vault = await Erc20Vault.at(await this.framework.vaults(config.registerKeys.vaultId.erc20));

        this.exitGame = await PaymentExitGame.at(await this.framework.exitGames(config.registerKeys.txTypes.payment));

        this.startStandardExitBondSize = await this.exitGame.startStandardExitBondSize();
        this.piggybackBondSize = await this.exitGame.piggybackBondSize();

        this.framework.addExitQueue(config.registerKeys.vaultId.eth, ETH);
    };

    const aliceDepositsETH = async () => {
        const depositBlockNum = (await this.framework.nextDepositBlock()).toNumber();
        this.depositUtxoPos = buildUtxoPos(depositBlockNum, 0, 0);
        this.depositTx = Testlang.deposit(OUTPUT_TYPE_PAYMENT, DEPOSIT_VALUE, alice);
        this.merkleTreeForDepositTx = new MerkleTree([this.depositTx], MERKLE_TREE_DEPTH);
        this.merkleProofForDepositTx = this.merkleTreeForDepositTx.getInclusionProof(this.depositTx);

        return this.ethVault.deposit(this.depositTx, { from: alice, value: DEPOSIT_VALUE });
    };

    const aliceTransferSomeEthToBob = async () => {
        const tranferTxBlockNum = (await this.framework.nextChildBlock()).toNumber();
        this.transferUtxoPos = buildUtxoPos(tranferTxBlockNum, 0, 0);

        const transferAmount = 1000;
        const outputBob = new PaymentTransactionOutput(OUTPUT_TYPE_PAYMENT, transferAmount, bob, ETH);
        const outputAlice = new PaymentTransactionOutput(
            OUTPUT_TYPE_PAYMENT, DEPOSIT_VALUE - transferAmount, alice, ETH,
        );
        this.transferTxObject = new PaymentTransaction(1, [this.depositUtxoPos], [outputBob, outputAlice]);
        this.transferTx = web3.utils.bytesToHex(this.transferTxObject.rlpEncoded());
        this.merkleTreeForTransferTx = new MerkleTree([this.transferTx]);
        this.merkleProofForTransferTx = this.merkleTreeForTransferTx.getInclusionProof(this.transferTx);

        await this.framework.submitBlock(this.merkleTreeForTransferTx.root, { from: authority });
    };

    const aliceDepositsErc20 = async () => {
        const depositBlockNum = (await this.framework.nextDepositBlock()).toNumber();
        this.depositUtxoPos = buildUtxoPos(depositBlockNum, 0, 0);
        this.depositTx = Testlang.deposit(OUTPUT_TYPE_PAYMENT, DEPOSIT_VALUE, alice, this.erc20.address);
        this.merkleTreeForDepositTx = new MerkleTree([this.depositTx], MERKLE_TREE_DEPTH);
        this.merkleProofForDepositTx = this.merkleTreeForDepositTx.getInclusionProof(this.depositTx);

        return this.erc20Vault.deposit(this.depositTx, { from: alice });
    };

    describe('Given contracts deployed, exit game and both ETH and ERC20 vault registered', () => {
        before(setupContracts);

        it('should not allow to call processExit from outside of exit game controller contract', async () => {
            await expectRevert(
                this.exitGame.processExit(0, config.registerKeys.vaultId.eth, constants.ZERO_ADDRESS),
                'Caller address is unauthorized.',
            );
        });

        describe('Given Alice deposited with ETH', () => {
            before(async () => {
                this.aliceBalanceBeforeDeposit = new BN(await web3.eth.getBalance(alice));
                this.ethVaultBalanceBeforeDeposit = new BN(await web3.eth.getBalance(this.ethVault.address));
                const { receipt } = await aliceDepositsETH();
                this.aliceDepositReceipt = receipt;
            });

            it('should have transferred the ETH from Alice to vault', async () => {
                const aliceBalanceAfterDeposit = new BN(await web3.eth.getBalance(alice));
                const ethVaultBalanceAfterDeposit = new BN(await web3.eth.getBalance(this.ethVault.address));
                const expectedAliceBalance = this.aliceBalanceBeforeDeposit
                    .sub(new BN(DEPOSIT_VALUE))
                    .sub(await spentOnGas(this.aliceDepositReceipt));
                const expectedEthVaultBalance = this.ethVaultBalanceBeforeDeposit.add(new BN(DEPOSIT_VALUE));

                expect(aliceBalanceAfterDeposit).to.be.bignumber.equal(expectedAliceBalance);
                expect(ethVaultBalanceAfterDeposit).to.be.bignumber.equal(expectedEthVaultBalance);
            });

            describe('When Alice starts standard exit on the deposit tx', () => {
                before(async () => {
                    const args = {
                        utxoPos: this.depositUtxoPos,
                        rlpOutputTx: this.depositTx,
                        outputTxInclusionProof: this.merkleProofForDepositTx,
                    };
                    await this.exitGame.startStandardExit(
                        args, { from: alice, value: this.startStandardExitBondSize },
                    );
                });

                it('should save the StandardExit data when successfully done', async () => {
                    const exitId = await this.exitGame.getStandardExitId(true, this.depositTx, this.depositUtxoPos);
                    const exitIds = [exitId];
                    const standardExitData = (await this.exitGame.standardExits(exitIds))[0];
                    const outputIndexForDeposit = 0;
                    const outputId = computeDepositOutputId(
                        this.depositTx, outputIndexForDeposit, this.depositUtxoPos,
                    );

                    expect(standardExitData.exitable).to.be.true;
                    expect(standardExitData.outputId).to.equal(outputId);
                    expect(new BN(standardExitData.utxoPos)).to.be.bignumber.equal(new BN(this.depositUtxoPos));
                    expect(standardExitData.exitTarget).to.equal(alice);
                    expect(new BN(standardExitData.amount)).to.be.bignumber.equal(new BN(DEPOSIT_VALUE));
                });

                it('should put the exit data into the queue of framework', async () => {
                    const queueKey = exitQueueKey(config.registerKeys.vaultId.eth, ETH);
                    const priorityQueueAddress = await this.framework.exitsQueues(queueKey);
                    const priorityQueue = await PriorityQueue.at(priorityQueueAddress);
                    const uniquePriority = await priorityQueue.getMin();

                    const currentTimestamp = await time.latest();
                    const exitableAt = await this.exitableHelper
                        .calculateDepositTxOutputExitableTimestamp(currentTimestamp);

                    const exitIdExpected = await this.exitGame.getStandardExitId(
                        true, this.depositTx, this.depositUtxoPos,
                    );
                    const priorityExpected = await this.exitPriorityHelper.computePriority(
                        exitableAt, utxoPosToTxPos(this.depositUtxoPos), exitIdExpected,
                    );

                    expect(uniquePriority).to.be.bignumber.equal(priorityExpected);
                });

                describe('And then someone processes the exits for ETH after a week', () => {
                    before(async () => {
                        await time.increase(time.duration.weeks(1).add(time.duration.seconds(1)));

                        this.aliceBalanceBeforeProcessExit = new BN(await web3.eth.getBalance(alice));

                        await this.framework.processExits(config.registerKeys.vaultId.eth, ETH, 0, 1);
                    });

                    it('should return the fund plus standard exit bond to Alice', async () => {
                        const actualAliceBalanceAfterProcessExit = new BN(await web3.eth.getBalance(alice));
                        const expectedAliceBalance = this.aliceBalanceBeforeProcessExit
                            .add(this.startStandardExitBondSize)
                            .add(new BN(DEPOSIT_VALUE));

                        expect(actualAliceBalanceAfterProcessExit).to.be.bignumber.equal(expectedAliceBalance);
                    });
                });
            });
        });

        describe('Given Alice deposited ETH and transferred some to Bob', () => {
            before(async () => {
                await aliceDepositsETH();
                await aliceTransferSomeEthToBob();
            });

            describe('When Bob tries to start the standard exit on the transfered tx', () => {
                before(async () => {
                    const args = {
                        utxoPos: this.transferUtxoPos,
                        rlpOutputTx: this.transferTx,
                        outputTxInclusionProof: this.merkleProofForTransferTx,
                    };

                    await this.exitGame.startStandardExit(
                        args, { from: bob, value: this.startStandardExitBondSize },
                    );
                });

                it('should start successully', async () => {
                    const exitId = await this.exitGame.getStandardExitId(
                        false, this.transferTx, this.transferUtxoPos,
                    );
                    const exitIds = [exitId];
                    const standardExitData = (await this.exitGame.standardExits(exitIds))[0];
                    expect(standardExitData.exitable).to.be.true;
                });

                describe('And then someone processes the exits for ETH after two weeks', () => {
                    before(async () => {
                        await time.increase(time.duration.weeks(2).add(time.duration.seconds(1)));

                        this.bobBalanceBeforeProcessExit = new BN(await web3.eth.getBalance(bob));

                        await this.framework.processExits(config.registerKeys.vaultId.eth, ETH, 0, 1);
                    });

                    it('should return the output amount plus standard exit bond to Bob', async () => {
                        const actualBobBalanceAfterProcessExit = new BN(await web3.eth.getBalance(bob));
                        const expectedBobBalance = this.bobBalanceBeforeProcessExit
                            .add(this.startStandardExitBondSize)
                            .add(new BN(this.transferTxObject.outputs[0].amount));

                        expect(actualBobBalanceAfterProcessExit).to.be.bignumber.equal(expectedBobBalance);
                    });
                });
            });
        });

        describe('Given Alice deposited ETH and transferred some to Bob', () => {
            before(async () => {
                await aliceDepositsETH();
                await aliceTransferSomeEthToBob();
            });

            describe('When Alice tries to start the standard exit on the deposit tx', () => {
                before(async () => {
                    this.startStandardExitArgs = {
                        utxoPos: this.depositUtxoPos,
                        rlpOutputTx: this.depositTx,
                        outputTxInclusionProof: this.merkleProofForDepositTx,
                    };

                    await this.exitGame.startStandardExit(
                        this.startStandardExitArgs, { from: alice, value: this.startStandardExitBondSize },
                    );

                    this.exitId = await this.exitGame.getStandardExitId(
                        true, this.depositTx, this.depositUtxoPos,
                    );
                });

                it('should still be able to start standard exit even already spent', async () => {
                    const standardExitData = (await this.exitGame.standardExits([this.exitId]))[0];
                    expect(standardExitData.exitable).to.be.true;
                });

                describe('Then Bob can challenge the standard exit spent', async () => {
                    before(async () => {
                        const txHash = hashTx(this.transferTxObject, this.framework.address);
                        const signature = sign(txHash, alicePrivateKey);

                        const args = {
                            exitId: this.exitId.toString(10),
                            exitingTx: this.depositTx,
                            challengeTx: this.transferTx,
                            inputIndex: 0,
                            witness: signature,
                        };

                        this.bobBalanceBeforeChallenge = new BN(await web3.eth.getBalance(bob));
                        this.challengeTx = await this.exitGame.challengeStandardExit(
                            args, { from: bob },
                        );
                    });

                    it('should challenge it successfully', async () => {
                        await expectEvent.inLogs(
                            this.challengeTx.logs,
                            'ExitChallenged',
                            { utxoPos: new BN(this.depositUtxoPos) },
                        );
                    });

                    it('should transfer the bond to Bob', async () => {
                        const actualBobBalanceAfterChallenge = new BN(await web3.eth.getBalance(bob));
                        const expectedBobBalanceAfterChallenge = this.bobBalanceBeforeChallenge
                            .add(this.startStandardExitBondSize)
                            .sub(await spentOnGas(this.challengeTx.receipt));

                        expect(actualBobBalanceAfterChallenge).to.be.bignumber.equal(expectedBobBalanceAfterChallenge);
                    });

                    it('should not allow Alice to restart the exit', async () => {
                        await expectRevert(
                            this.exitGame.startStandardExit(
                                this.startStandardExitArgs, { from: alice, value: this.startStandardExitBondSize },
                            ),
                            'Exit has already started.',
                        );
                    });

                    describe('And then someone processes the exits for ETH after two weeks', () => {
                        before(async () => {
                            this.ethVaultBalance = new BN(await web3.eth.getBalance(this.ethVault.address));
                            await time.increase(time.duration.weeks(2).add(time.duration.seconds(1)));

                            const { receipt } = await this.framework.processExits(
                                config.registerKeys.vaultId.eth,
                                ETH,
                                0,
                                1,
                            );
                            this.processExitsReceipt = receipt;
                        });

                        it('should be omitted', async () => {
                            await expectEvent.inTransaction(
                                this.processExitsReceipt.transactionHash,
                                PaymentProcessStandardExit,
                                'ExitOmitted',
                                { exitId: this.exitId },
                            );
                        });

                        it('should not withdraw funds from the vault', async () => {
                            const actualEthVaultBalance = new BN(await web3.eth.getBalance(this.ethVault.address));
                            expect(actualEthVaultBalance).to.be.bignumber.equal(this.ethVaultBalance);
                        });
                    });
                });
            });
        });

        describe('Given Alice deposited with ERC20 token', () => {
            before(async () => {
                await this.erc20.transfer(alice, DEPOSIT_VALUE, { from: richFather });
                await this.erc20.approve(this.erc20Vault.address, DEPOSIT_VALUE, { from: alice });

                this.aliceErc20BalanceBeforeDeposit = new BN(await this.erc20.balanceOf(alice));
                this.erc20VaultBalanceBeforeDeposit = new BN(await this.erc20.balanceOf(this.erc20Vault.address));
                await aliceDepositsErc20();
            });

            it('should have transferred the ERC20 token from Alice to vault', async () => {
                const aliceErc20BalanceAfterDeposit = new BN(await this.erc20.balanceOf(alice));
                const erc20VaultBalanceAfterDeposit = new BN(await this.erc20.balanceOf(this.erc20Vault.address));
                const expectedAliceBalance = this.aliceErc20BalanceBeforeDeposit.sub(new BN(DEPOSIT_VALUE));
                const expectedErc20VaultBalance = this.erc20VaultBalanceBeforeDeposit.add(new BN(DEPOSIT_VALUE));

                expect(aliceErc20BalanceAfterDeposit).to.be.bignumber.equal(expectedAliceBalance);
                expect(erc20VaultBalanceAfterDeposit).to.be.bignumber.equal(expectedErc20VaultBalance);
            });

            describe('Given ERC20 token added to the PlasmaFramework', () => {
                before(async () => {
                    await this.framework.addExitQueue(config.registerKeys.vaultId.erc20, this.erc20.address);
                });

                it('should have the ERC20 token', async () => {
                    expect(
                        await this.framework.hasExitQueue(config.registerKeys.vaultId.erc20, this.erc20.address),
                    ).to.be.true;
                });

                describe('When Alice starts standard exit on the ERC20 deposit tx', () => {
                    before(async () => {
                        const args = {
                            utxoPos: this.depositUtxoPos,
                            rlpOutputTx: this.depositTx,
                            outputTxInclusionProof: this.merkleProofForDepositTx,
                        };

                        await this.exitGame.startStandardExit(
                            args, { from: alice, value: this.startStandardExitBondSize },
                        );
                    });

                    it('should start successully', async () => {
                        const isDeposit = true;
                        const exitId = await this.exitGame.getStandardExitId(
                            isDeposit, this.depositTx, this.depositUtxoPos,
                        );
                        const exitIds = [exitId];
                        const standardExitData = (await this.exitGame.standardExits(exitIds))[0];
                        expect(standardExitData.exitable).to.be.true;
                    });

                    describe('And then someone processes the exits for the ERC20 token after a week', () => {
                        before(async () => {
                            await time.increase(time.duration.weeks(1).add(time.duration.seconds(1)));

                            this.aliceEthBalanceBeforeProcessExit = new BN(await web3.eth.getBalance(alice));
                            this.aliceErc20BalanceBeforeProcessExit = new BN(await this.erc20.balanceOf(alice));

                            await this.framework.processExits(
                                config.registerKeys.vaultId.erc20,
                                this.erc20.address,
                                0,
                                1,
                            );
                        });

                        it('should return the standard exit bond in ETH to Alice', async () => {
                            const actualAliceEthBalanceAfterProcessExit = new BN(await web3.eth.getBalance(alice));
                            const expectedAliceEthBalance = this.aliceEthBalanceBeforeProcessExit
                                .add(this.startStandardExitBondSize);

                            expect(actualAliceEthBalanceAfterProcessExit)
                                .to.be.bignumber.equal(expectedAliceEthBalance);
                        });

                        it('should return ERC20 token with deposited amount to Alice', async () => {
                            const actualAliceErc20BalanceAfterProcessExit = new BN(await this.erc20.balanceOf(alice));
                            const expectedAliceErc20Balance = this.aliceErc20BalanceBeforeProcessExit
                                .add(new BN(DEPOSIT_VALUE));

                            expect(actualAliceErc20BalanceAfterProcessExit)
                                .to.be.bignumber.equal(expectedAliceErc20Balance);
                        });
                    });
                });
            });
        });
    });
});
