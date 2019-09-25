const EthVault = artifacts.require('EthVault');
const Erc20Vault = artifacts.require('Erc20Vault');
const EthDepositVerifier = artifacts.require('EthDepositVerifier');
const Erc20DepositVerifier = artifacts.require('Erc20DepositVerifier');
const ExitableTimestamp = artifacts.require('ExitableTimestampWrapper');
const ExitId = artifacts.require('ExitIdWrapper');
const ExitPriority = artifacts.require('ExitPriorityWrapper');
const ERC20Mintable = artifacts.require('ERC20Mintable');
const OutputGuardHandlerRegistry = artifacts.require('OutputGuardHandlerRegistry');
const PaymentExitGame = artifacts.require('PaymentExitGame');
const PaymentChallengeStandardExit = artifacts.require('PaymentChallengeStandardExit');
const PaymentChallengeIFENotCanonical = artifacts.require('PaymentChallengeIFENotCanonical');
const PaymentChallengeIFEInputSpent = artifacts.require('PaymentChallengeIFEInputSpent');
const PaymentChallengeIFEOutputSpent = artifacts.require('PaymentChallengeIFEOutputSpent');
const PaymentOutputGuardHandler = artifacts.require('PaymentOutputGuardHandler');
const PaymentOutputToPaymentTxCondition = artifacts.require('PaymentOutputToPaymentTxCondition');
const PaymentStartInFlightExit = artifacts.require('PaymentStartInFlightExit');
const PaymentStartStandardExit = artifacts.require('PaymentStartStandardExit');
const PaymentTransactionStateTransitionVerifier = artifacts.require('PaymentTransactionStateTransitionVerifier');
const PaymentPiggybackInFlightExit = artifacts.require('PaymentPiggybackInFlightExit');
const PaymentProcessStandardExit = artifacts.require('PaymentProcessStandardExit');
const PaymentProcessInFlightExit = artifacts.require('PaymentProcessInFlightExit');
const PlasmaFramework = artifacts.require('PlasmaFramework');
const PriorityQueue = artifacts.require('PriorityQueue');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const {
    PROTOCOL, TX_TYPE, OUTPUT_TYPE, EMPTY_BYTES,
} = require('../../../helpers/constants.js');
const { MerkleTree } = require('../../../helpers/merkle.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../../../helpers/transaction.js');
const { computeDepositOutputId, spentOnGas } = require('../../../helpers/utils.js');
const { sign } = require('../../../helpers/sign.js');
const { hashTx } = require('../../../helpers/paymentEip712.js');
const { buildUtxoPos, utxoPosToTxPos } = require('../../../helpers/positions.js');
const Testlang = require('../../../helpers/testlang.js');

contract('PaymentExitGame - End to End Tests', ([_, richFather, bob]) => {
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week
    const ETH = constants.ZERO_ADDRESS;
    const INITIAL_ERC20_SUPPLY = 10000000000;
    const DEPOSIT_VALUE = 1000000;
    const INITIAL_IMMUNE_VAULTS = 2; // ETH and ERC20 vault
    const INITIAL_IMMUNE_EXIT_GAMES = 1; // 1 for PaymentExitGame

    const alicePrivateKey = '0x7151e5dab6f8e95b5436515b83f423c4df64fe4c6149f864daa209b26adb10ca';
    let alice;

    const linkLibraries = async () => {
        const startStandardExit = await PaymentStartStandardExit.new();
        const challengeStandardExit = await PaymentChallengeStandardExit.new();
        const processStandardExit = await PaymentProcessStandardExit.new();
        const startInFlightExit = await PaymentStartInFlightExit.new();
        const piggybackInFlightExit = await PaymentPiggybackInFlightExit.new();
        const challengeInFlightExitNotCanonical = await PaymentChallengeIFENotCanonical.new();
        const challengeIFEInputSpent = await PaymentChallengeIFEInputSpent.new();
        const challengeIFEOutput = await PaymentChallengeIFEOutputSpent.new();
        const processInFlightExit = await PaymentProcessInFlightExit.new();

        await PaymentExitGame.link('PaymentStartStandardExit', startStandardExit.address);
        await PaymentExitGame.link('PaymentChallengeStandardExit', challengeStandardExit.address);
        await PaymentExitGame.link('PaymentProcessStandardExit', processStandardExit.address);
        await PaymentExitGame.link('PaymentStartInFlightExit', startInFlightExit.address);
        await PaymentExitGame.link('PaymentPiggybackInFlightExit', piggybackInFlightExit.address);
        await PaymentExitGame.link('PaymentChallengeIFENotCanonical', challengeInFlightExitNotCanonical.address);
        await PaymentExitGame.link('PaymentChallengeIFEInputSpent', challengeIFEInputSpent.address);
        await PaymentExitGame.link('PaymentChallengeIFEOutputSpent', challengeIFEOutput.address);
        await PaymentExitGame.link('PaymentProcessInFlightExit', processInFlightExit.address);
    };

    const setupAccount = async () => {
        const password = 'password1234';
        alice = await web3.eth.personal.importRawKey(alicePrivateKey, password);
        alice = web3.utils.toChecksumAddress(alice);
        web3.eth.personal.unlockAccount(alice, password, 3600);
        web3.eth.sendTransaction({ to: alice, from: richFather, value: web3.utils.toWei('1', 'ether') });
    };

    const deployStableContracts = async () => {
        this.exitIdHelper = await ExitId.new();
        this.exitPriorityHelper = await ExitPriority.new();

        this.erc20 = await ERC20Mintable.new();
        await this.erc20.mint(richFather, INITIAL_ERC20_SUPPLY);
        this.exitableHelper = await ExitableTimestamp.new(MIN_EXIT_PERIOD);
    };

    before(async () => {
        await Promise.all([linkLibraries(), setupAccount(), deployStableContracts()]);
    });

    const setupContracts = async () => {
        this.framework = await PlasmaFramework.new(MIN_EXIT_PERIOD, INITIAL_IMMUNE_VAULTS, INITIAL_IMMUNE_EXIT_GAMES);
        await this.framework.initAuthority();

        const ethDepositVerifier = await EthDepositVerifier.new();
        this.ethVault = await EthVault.new(this.framework.address);
        await this.ethVault.setDepositVerifier(ethDepositVerifier.address);

        const erc20DepositVerifier = await Erc20DepositVerifier.new();
        this.erc20Vault = await Erc20Vault.new(this.framework.address);
        await this.erc20Vault.setDepositVerifier(erc20DepositVerifier.address);

        await this.framework.registerVault(1, this.ethVault.address);
        await this.framework.registerVault(2, this.erc20Vault.address);

        const outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();
        const paymentOutputGuardHandler = await PaymentOutputGuardHandler.new(OUTPUT_TYPE.PAYMENT);
        await outputGuardHandlerRegistry.registerOutputGuardHandler(
            OUTPUT_TYPE.PAYMENT, paymentOutputGuardHandler.address,
        );

        const spendingConditionRegistry = await SpendingConditionRegistry.new();
        const stateVerifier = await PaymentTransactionStateTransitionVerifier.new();
        this.exitGame = await PaymentExitGame.new(
            this.framework.address,
            this.ethVault.address,
            this.erc20Vault.address,
            outputGuardHandlerRegistry.address,
            spendingConditionRegistry.address,
            stateVerifier.address,
            TX_TYPE.PAYMENT,
        );

        this.startStandardExitBondSize = await this.exitGame.startStandardExitBondSize();

        this.toPaymentCondition = await PaymentOutputToPaymentTxCondition.new(
            this.framework.address, TX_TYPE.PAYMENT, TX_TYPE.PAYMENT,
        );
        await spendingConditionRegistry.registerSpendingCondition(
            OUTPUT_TYPE.PAYMENT, TX_TYPE.PAYMENT, this.toPaymentCondition.address,
        );
        await this.framework.registerExitGame(TX_TYPE.PAYMENT, this.exitGame.address, PROTOCOL.MORE_VP);
    };

    const aliceDepositsETH = async () => {
        const depositBlockNum = (await this.framework.nextDepositBlock()).toNumber();
        this.depositUtxoPos = buildUtxoPos(depositBlockNum, 0, 0);
        this.depositTx = Testlang.deposit(DEPOSIT_VALUE, alice);
        this.merkleTreeForDepositTx = new MerkleTree([this.depositTx], 16);
        this.merkleProofForDepositTx = this.merkleTreeForDepositTx.getInclusionProof(this.depositTx);

        return this.ethVault.deposit(this.depositTx, { from: alice, value: DEPOSIT_VALUE });
    };

    const aliceTransferSomeEthToBob = async () => {
        const tranferTxBlockNum = (await this.framework.nextChildBlock()).toNumber();
        this.transferUtxoPos = buildUtxoPos(tranferTxBlockNum, 0, 0);

        const transferAmount = 1000;
        const outputBob = new PaymentTransactionOutput(transferAmount, bob, ETH);
        const outputAlice = new PaymentTransactionOutput(
            DEPOSIT_VALUE - transferAmount, alice, ETH,
        );
        this.transferTxObject = new PaymentTransaction(1, [this.depositUtxoPos], [outputBob, outputAlice]);
        this.transferTx = this.transferTxObject.rlpEncoded();
        this.merkleTreeForTransferTx = new MerkleTree([this.transferTx]);
        this.merkleProofForTransferTx = this.merkleTreeForTransferTx.getInclusionProof(this.transferTx);

        await this.framework.submitBlock(this.merkleTreeForTransferTx.root);
    };

    const aliceDepositsErc20 = async () => {
        const depositBlockNum = (await this.framework.nextDepositBlock()).toNumber();
        this.depositUtxoPos = buildUtxoPos(depositBlockNum, 0, 0);
        this.depositTx = Testlang.deposit(DEPOSIT_VALUE, alice, this.erc20.address);
        this.merkleTreeForDepositTx = new MerkleTree([this.depositTx], 16);
        this.merkleProofForDepositTx = this.merkleTreeForDepositTx.getInclusionProof(this.depositTx);

        return this.erc20Vault.deposit(this.depositTx, { from: alice });
    };

    describe('Given contracts deployed, exit game and both ETH and ERC20 vault registered', () => {
        beforeEach(setupContracts);

        it('should not allow to call processExit from outside of exit game controller contract', async () => {
            await expectRevert(
                this.exitGame.processExit(0, constants.ZERO_ADDRESS),
                'Not being called by expected caller.',
            );
        });

        describe('Given Alice deposited with ETH', () => {
            beforeEach(async () => {
                this.aliceBalanceBeforeDeposit = new BN(await web3.eth.getBalance(alice));
                this.ethVaultBalanceBeforeDeposit = new BN(await web3.eth.getBalance(this.ethVault.address));
                const { receipt } = await aliceDepositsETH();
                this.aliceDepositReceipt = receipt;
            });

            it('should have transfered the ETH from Alice to vault', async () => {
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
                beforeEach(async () => {
                    const args = {
                        utxoPos: this.depositUtxoPos,
                        rlpOutputTx: this.depositTx,
                        outputType: OUTPUT_TYPE.PAYMENT,
                        outputGuardPreimage: EMPTY_BYTES,
                        outputTxInclusionProof: this.merkleProofForDepositTx,
                    };
                    await this.exitGame.startStandardExit(
                        args, { from: alice, value: this.startStandardExitBondSize },
                    );
                });

                it('should save the StandardExit data when successfully done', async () => {
                    const exitId = await this.exitIdHelper.getStandardExitId(true, this.depositTx, this.depositUtxoPos);
                    const standardExitData = await this.exitGame.standardExits(exitId);

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
                    const priorityQueueAddress = await this.framework.exitsQueues(ETH);
                    const priorityQueue = await PriorityQueue.at(priorityQueueAddress);
                    const uniquePriority = await priorityQueue.getMin();

                    const currentTimestamp = await time.latest();
                    const isTxDeposit = true;
                    const timestamp = currentTimestamp.sub(new BN(15));
                    const exitableAt = await this.exitableHelper.calculate(
                        currentTimestamp, timestamp, isTxDeposit,
                    );

                    const exitIdExpected = await this.exitIdHelper.getStandardExitId(
                        true, this.depositTx, this.depositUtxoPos,
                    );
                    const priorityExpected = await this.exitPriorityHelper.computePriority(
                        exitableAt, utxoPosToTxPos(this.depositUtxoPos), exitIdExpected,
                    );

                    expect(uniquePriority).to.be.bignumber.equal(priorityExpected);
                });

                describe('And then someone processes the exits for ETH after a week', () => {
                    beforeEach(async () => {
                        await time.increase(time.duration.weeks(1).add(time.duration.seconds(1)));

                        this.aliceBalanceBeforeProcessExit = new BN(await web3.eth.getBalance(alice));

                        await this.framework.processExits(ETH, 0, 1);
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
            beforeEach(async () => {
                await aliceDepositsETH();
                await aliceTransferSomeEthToBob();
            });

            describe('When Bob tries to start the standard exit on the transfered tx', () => {
                beforeEach(async () => {
                    const args = {
                        utxoPos: this.transferUtxoPos,
                        rlpOutputTx: this.transferTx,
                        outputType: OUTPUT_TYPE.PAYMENT,
                        outputGuardPreimage: EMPTY_BYTES,
                        outputTxInclusionProof: this.merkleProofForTransferTx,
                    };

                    await this.exitGame.startStandardExit(
                        args, { from: bob, value: this.startStandardExitBondSize },
                    );
                });

                it('should start successully', async () => {
                    const exitId = await this.exitIdHelper.getStandardExitId(
                        false, this.transferTx, this.transferUtxoPos,
                    );
                    const standardExitData = await this.exitGame.standardExits(exitId);
                    expect(standardExitData.exitable).to.be.true;
                });

                describe('And then someone processes the exits for ETH after two weeks', () => {
                    beforeEach(async () => {
                        await time.increase(time.duration.weeks(2).add(time.duration.seconds(1)));

                        this.bobBalanceBeforeProcessExit = new BN(await web3.eth.getBalance(bob));

                        await this.framework.processExits(ETH, 0, 1);
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

        describe('Given Alice deposited ETH and transfered some to Bob', () => {
            beforeEach(async () => {
                await aliceDepositsETH();
                await aliceTransferSomeEthToBob();
            });

            describe('When Alice tries to start the standard exit on the deposit tx', () => {
                beforeEach(async () => {
                    const args = {
                        utxoPos: this.depositUtxoPos,
                        rlpOutputTx: this.depositTx,
                        outputType: OUTPUT_TYPE.PAYMENT,
                        outputGuardPreimage: EMPTY_BYTES,
                        outputTxInclusionProof: this.merkleProofForDepositTx,
                    };

                    await this.exitGame.startStandardExit(
                        args, { from: alice, value: this.startStandardExitBondSize },
                    );

                    this.exitId = await this.exitIdHelper.getStandardExitId(
                        true, this.depositTx, this.depositUtxoPos,
                    );
                });

                it('should still be able to start standard exit even already spent', async () => {
                    const standardExitData = await this.exitGame.standardExits(this.exitId);
                    expect(standardExitData.exitable).to.be.true;
                });

                describe('Then Bob can challenge the standard exit spent', async () => {
                    beforeEach(async () => {
                        const txHash = hashTx(this.transferTxObject, this.framework.address);
                        const signature = sign(txHash, alicePrivateKey);

                        const args = {
                            exitId: this.exitId.toString(10),
                            outputType: OUTPUT_TYPE.PAYMENT,
                            exitingTx: this.depositTx,
                            challengeTxType: TX_TYPE.PAYMENT,
                            challengeTx: this.transferTx,
                            inputIndex: 0,
                            witness: signature,
                            spendingConditionOptionalArgs: EMPTY_BYTES,
                            outputGuardPreimage: EMPTY_BYTES,
                            challengeTxPos: 0,
                            challengeTxInclusionProof: EMPTY_BYTES,
                            challengeTxConfirmSig: EMPTY_BYTES,
                        };

                        this.bobBalanceBeforeChallenge = new BN(await web3.eth.getBalance(bob));
                        const { receipt } = await this.exitGame.challengeStandardExit(
                            args, { from: bob },
                        );
                        this.challengeTxReciept = receipt;
                    });

                    it('should challenge it successfully', async () => {
                        await expectEvent.inTransaction(
                            this.challengeTxReciept.transactionHash,
                            PaymentChallengeStandardExit,
                            'ExitChallenged',
                            { utxoPos: new BN(this.depositUtxoPos) },
                        );
                    });

                    it('should transfer the bond to Bob', async () => {
                        const actualBobBalanceAfterChallenge = new BN(await web3.eth.getBalance(bob));
                        const expectedBobBalanceAfterChallenge = this.bobBalanceBeforeChallenge
                            .add(this.startStandardExitBondSize)
                            .sub(await spentOnGas(this.challengeTxReciept));

                        expect(actualBobBalanceAfterChallenge).to.be.bignumber.equal(expectedBobBalanceAfterChallenge);
                    });

                    describe('And then someone processes the exits for ETH after two weeks', () => {
                        beforeEach(async () => {
                            await time.increase(time.duration.weeks(2).add(time.duration.seconds(1)));

                            const { receipt } = await this.framework.processExits(ETH, 0, 1);
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
                    });
                });
            });
        });


        describe('Given Alice deposited with ERC20 token', () => {
            beforeEach(async () => {
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
                beforeEach(async () => {
                    await this.framework.addToken(this.erc20.address);
                });

                it('should have the ERC20 token', async () => {
                    expect(await this.framework.hasToken(this.erc20.address)).to.be.true;
                });

                describe('When Alice starts standard exit on the ERC20 deposit tx', () => {
                    beforeEach(async () => {
                        const args = {
                            utxoPos: this.depositUtxoPos,
                            rlpOutputTx: this.depositTx,
                            outputType: OUTPUT_TYPE.PAYMENT,
                            outputGuardPreimage: EMPTY_BYTES,
                            outputTxInclusionProof: this.merkleProofForDepositTx,
                        };

                        await this.exitGame.startStandardExit(
                            args, { from: alice, value: this.startStandardExitBondSize },
                        );
                    });

                    it('should start successully', async () => {
                        const isDeposit = true;
                        const exitId = await this.exitIdHelper.getStandardExitId(
                            isDeposit, this.depositTx, this.depositUtxoPos,
                        );
                        const standardExitData = await this.exitGame.standardExits(exitId);
                        expect(standardExitData.exitable).to.be.true;
                    });

                    describe('And then someone processes the exits for the ERC20 token after a week', () => {
                        beforeEach(async () => {
                            await time.increase(time.duration.weeks(1).add(time.duration.seconds(1)));

                            this.aliceEthBalanceBeforeProcessExit = new BN(await web3.eth.getBalance(alice));
                            this.aliceErc20BalanceBeforeProcessExit = new BN(await this.erc20.balanceOf(alice));

                            await this.framework.processExits(this.erc20.address, 0, 1);
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
