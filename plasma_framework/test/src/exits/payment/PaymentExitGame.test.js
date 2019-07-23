const EthVault = artifacts.require('EthVault');
const Erc20Vault = artifacts.require('Erc20Vault');
const EthDepositVerifier = artifacts.require('EthDepositVerifier');
const Erc20DepositVerifier = artifacts.require('Erc20DepositVerifier');
const ExitId = artifacts.require('ExitIdWrapper');
const GoodERC20 = artifacts.require('GoodERC20');
const PaymentExitGame = artifacts.require('PaymentExitGame');
const PaymentOutputToPaymentTxCondition = artifacts.require('PaymentOutputToPaymentTxCondition');
const PlasmaFramework = artifacts.require('PlasmaFramework');
const PriorityQueue = artifacts.require('PriorityQueue');

const {
    BN, constants, expectEvent, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { MerkleTree } = require('../../../helpers/merkle.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../../../helpers/transaction.js');
const { addressToOutputGuard, computeDepositOutputId, spentOnGas } = require('../../../helpers/utils.js');
const { sign } = require('../../../helpers/sign.js');
const { hashTx } = require('../../../helpers/paymentEip712.js');
const { buildUtxoPos } = require('../../../helpers/utxoPos.js');
const Testlang = require('../../../helpers/testlang.js');

contract('PaymentExitGame - End to End Tests', ([_, richFather, bob]) => {
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week
    const INITIAL_IMMUME_VAULTS_NUM = 2; // ETH and ERC20 vault
    const STANDARD_EXIT_BOND = 31415926535; // wei
    const ETH = constants.ZERO_ADDRESS;
    const INITIAL_ERC20_SUPPLY = 10000000000;
    const DEPOSIT_VALUE = 1000000;
    const OUTPUT_TYPE_ZERO = 0;
    const EMPTY_BYTES = '0x';
    const PAYMENT_TX_TYPE = 1;
    const INITIAL_IMMUNE_VAULTS = 2;
    const INITIAL_IMMUNE_EXIT_GAMES = 1;

    const alicePrivateKey = '0x7151e5dab6f8e95b5436515b83f423c4df64fe4c6149f864daa209b26adb10ca';
    let alice;

    before(async () => {
        const password = 'password1234';
        alice = await web3.eth.personal.importRawKey(alicePrivateKey, password);
        alice = web3.utils.toChecksumAddress(alice);
        web3.eth.personal.unlockAccount(alice, password, 3600);
        web3.eth.sendTransaction({ to: alice, from: richFather, value: web3.utils.toWei('1', 'ether') });

        this.exitIdHelper = await ExitId.new();

        this.erc20 = await GoodERC20.new();
        await this.erc20.mint(richFather, INITIAL_ERC20_SUPPLY);
    });

    const setupContracts = async () => {
        this.framework = await PlasmaFramework.new(MIN_EXIT_PERIOD, INITIAL_IMMUNE_VAULTS, INITIAL_IMMUNE_EXIT_GAMES);

        const ethDepositVerifier = await EthDepositVerifier.new();
        this.ethVault = await EthVault.new(this.framework.address);
        await this.ethVault.setDepositVerifier(ethDepositVerifier.address);

        const erc20DepositVerifier = await Erc20DepositVerifier.new();
        this.erc20Vault = await Erc20Vault.new(this.framework.address);
        await this.erc20Vault.setDepositVerifier(erc20DepositVerifier.address);

        await this.framework.registerVault(1, this.ethVault.address);
        await this.framework.registerVault(2, this.erc20Vault.address);

        this.exitGame = await PaymentExitGame.new(
            this.framework.address, this.ethVault.address, this.erc20Vault.address,
        );

        this.toPaymentCondition = await PaymentOutputToPaymentTxCondition.new(this.framework.address);
        await this.exitGame.registerSpendingCondition(
            OUTPUT_TYPE_ZERO, PAYMENT_TX_TYPE, this.toPaymentCondition.address,
        );
        await this.framework.registerExitGame(PAYMENT_TX_TYPE, this.exitGame.address);
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
        const outputBob = new PaymentTransactionOutput(transferAmount, addressToOutputGuard(bob), ETH);
        const outputAlice = new PaymentTransactionOutput(
            DEPOSIT_VALUE - transferAmount, addressToOutputGuard(alice), ETH,
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

        describe('Given alice deposited with ETH', () => {
            beforeEach(async () => {
                this.aliceBalanceBeforeDeposit = new BN(await web3.eth.getBalance(alice));
                this.ethVaultBalanceBeforeDeposit = new BN(await web3.eth.getBalance(this.ethVault.address));
                const { receipt } = await aliceDepositsETH();
                this.aliceDepositReceipt = receipt;
            });

            it('should have transfered the ETH from alice to vault', async () => {
                const aliceBalanceAfterDeposit = new BN(await web3.eth.getBalance(alice));
                const ethVaultBalanceAfterDeposit = new BN(await web3.eth.getBalance(this.ethVault.address));
                const expectedAliceBalance = this.aliceBalanceBeforeDeposit
                    .sub(new BN(DEPOSIT_VALUE))
                    .sub(await spentOnGas(this.aliceDepositReceipt));
                const expectedEthVaultBalance = this.ethVaultBalanceBeforeDeposit.add(new BN(DEPOSIT_VALUE));

                expect(aliceBalanceAfterDeposit).to.be.bignumber.equal(expectedAliceBalance);
                expect(ethVaultBalanceAfterDeposit).to.be.bignumber.equal(expectedEthVaultBalance);
            });

            describe('When alice starts standard exit on the deposit tx', () => {
                beforeEach(async () => {
                    await this.exitGame.startStandardExit(
                        this.depositUtxoPos, this.depositTx, OUTPUT_TYPE_ZERO,
                        EMPTY_BYTES, this.merkleProofForDepositTx,
                        { from: alice, value: STANDARD_EXIT_BOND },
                    );
                });

                it('should save the StandardExit data when successfully done', async () => {
                    const exitId = await this.exitIdHelper.getStandardExitId(true, this.depositTx, this.depositUtxoPos);
                    const standardExitData = await this.exitGame.exits(exitId);

                    const outputIndexForDeposit = 0;
                    const outputId = computeDepositOutputId(
                        this.depositTx, outputIndexForDeposit, this.depositUtxoPos,
                    );
                    const expectedOutputTypeAndGuardHash = web3.utils.soliditySha3(
                        { t: 'uint256', v: OUTPUT_TYPE_ZERO }, { t: 'bytes32', v: addressToOutputGuard(alice) },
                    );

                    expect(standardExitData.exitable).to.be.true;
                    expect(standardExitData.outputId).to.equal(outputId);
                    expect(standardExitData.utxoPos).to.be.bignumber.equal(new BN(this.depositUtxoPos));
                    expect(standardExitData.outputTypeAndGuardHash).to.equal(expectedOutputTypeAndGuardHash);
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

                describe('And then someone processes the exits for ETH after a week', () => {
                    beforeEach(async () => {
                        await time.increase(time.duration.weeks(1).add(time.duration.seconds(1)));

                        this.aliceBalanceBeforeProcessExit = new BN(await web3.eth.getBalance(alice));

                        await this.framework.processExits(ETH, 0, 1);
                    });

                    it('should return the fund plus standard exit bond to alice', async () => {
                        const actualAliceBalanceAfterProcessExit = new BN(await web3.eth.getBalance(alice));
                        const expectedAliceBalance = this.aliceBalanceBeforeProcessExit
                            .add(new BN(STANDARD_EXIT_BOND))
                            .add(new BN(DEPOSIT_VALUE));

                        expect(actualAliceBalanceAfterProcessExit).to.be.bignumber.equal(expectedAliceBalance);
                    });
                });
            });
        });

        describe('Given alice deposited ETH and transferred some to bob', () => {
            beforeEach(async () => {
                await aliceDepositsETH();
                await aliceTransferSomeEthToBob();
            });

            describe('When bob tries to start the standard exit on the transfered tx', () => {
                beforeEach(async () => {
                    await this.exitGame.startStandardExit(
                        this.transferUtxoPos, this.transferTx, OUTPUT_TYPE_ZERO,
                        EMPTY_BYTES, this.merkleProofForTransferTx,
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

                describe('And then someone processes the exits for ETH after two weeks', () => {
                    beforeEach(async () => {
                        await time.increase(time.duration.weeks(2).add(time.duration.seconds(1)));

                        this.bobBalanceBeforeProcessExit = new BN(await web3.eth.getBalance(bob));

                        await this.framework.processExits(ETH, 0, 1);
                    });

                    it('should return the output amount plus standard exit bond to bob', async () => {
                        const actualBobBalanceAfterProcessExit = new BN(await web3.eth.getBalance(bob));
                        const expectedBobBalance = this.bobBalanceBeforeProcessExit
                            .add(new BN(STANDARD_EXIT_BOND))
                            .add(new BN(this.transferTxObject.outputs[0].amount));

                        expect(actualBobBalanceAfterProcessExit).to.be.bignumber.equal(expectedBobBalance);
                    });
                });
            });
        });

        describe('Given alice deposited ETH and transfered some to bob', () => {
            beforeEach(async () => {
                await aliceDepositsETH();
                await aliceTransferSomeEthToBob();
            });

            describe('When alice tries to start the standard exit on the deposit tx', () => {
                beforeEach(async () => {
                    await this.exitGame.startStandardExit(
                        this.depositUtxoPos, this.depositTx, OUTPUT_TYPE_ZERO,
                        EMPTY_BYTES, this.merkleProofForDepositTx,
                        { from: alice, value: STANDARD_EXIT_BOND },
                    );
                    this.exitId = await this.exitIdHelper.getStandardExitId(
                        true, this.depositTx, this.depositUtxoPos,
                    );
                });

                it('should still be able to start standard exit even already spent', async () => {
                    const standardExitData = await this.exitGame.exits(this.exitId);
                    expect(standardExitData.exitable).to.be.true;
                });

                describe('Then bob can challenge the standard exit spent', async () => {
                    beforeEach(async () => {
                        const txHash = hashTx(this.transferTxObject, this.framework.address);
                        const signature = sign(txHash, alicePrivateKey);

                        const input = {
                            exitId: this.exitId.toString(10),
                            outputType: OUTPUT_TYPE_ZERO,
                            outputUtxoPos: this.depositUtxoPos,
                            outputId: computeDepositOutputId(this.depositTx, 0, this.depositUtxoPos),
                            outputGuard: addressToOutputGuard(alice),
                            challengeTxType: PAYMENT_TX_TYPE,
                            challengeTx: this.transferTx,
                            inputIndex: 0,
                            witness: signature,
                        };

                        this.bobBalanceBeforeChallenge = new BN(await web3.eth.getBalance(bob));
                        const { logs, receipt } = await this.exitGame.challengeStandardExit(
                            input, { from: bob },
                        );
                        this.challengeTxLogs = logs;
                        this.challengeTxReciept = receipt;
                    });

                    it('should challenge it successfully', async () => {
                        expectEvent.inLogs(
                            this.challengeTxLogs,
                            'ExitChallenged',
                            { utxoPos: new BN(this.depositUtxoPos) },
                        );
                    });

                    it('should transfer the bond to bob', async () => {
                        const actualBobBalanceAfterChallenge = new BN(await web3.eth.getBalance(bob));
                        const expectedBobBalanceAfterChallenge = this.bobBalanceBeforeChallenge
                            .add(new BN(STANDARD_EXIT_BOND))
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
                                PaymentExitGame,
                                'ExitOmitted',
                                { exitId: this.exitId },
                            );
                        });
                    });
                });
            });
        });


        describe('Given alice deposited with ERC20 token', () => {
            beforeEach(async () => {
                await this.erc20.transfer(alice, DEPOSIT_VALUE, { from: richFather });
                await this.erc20.approve(this.erc20Vault.address, DEPOSIT_VALUE, { from: alice });

                this.aliceErc20BalanceBeforeDeposit = new BN(await this.erc20.balanceOf(alice));
                this.erc20VaultBalanceBeforeDeposit = new BN(await this.erc20.balanceOf(this.erc20Vault.address));
                await aliceDepositsErc20();
            });

            it('should have transferred the ERC20 token from alice to vault', async () => {
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

                it('should has the ERC20 token', async () => {
                    expect(await this.framework.hasToken(this.erc20.address)).to.be.true;
                });

                describe('When alice starts standard exit on the ERC20 deposit tx', () => {
                    beforeEach(async () => {
                        await this.exitGame.startStandardExit(
                            this.depositUtxoPos, this.depositTx, OUTPUT_TYPE_ZERO,
                            EMPTY_BYTES, this.merkleProofForDepositTx,
                            { from: alice, value: STANDARD_EXIT_BOND },
                        );
                    });

                    it('should start successully', async () => {
                        const isDeposit = true;
                        const exitId = await this.exitIdHelper.getStandardExitId(
                            isDeposit, this.depositTx, this.depositUtxoPos,
                        );
                        const standardExitData = await this.exitGame.exits(exitId);
                        expect(standardExitData.exitable).to.be.true;
                    });

                    describe('And then someone processes the exits for the ERC20 token after a week', () => {
                        beforeEach(async () => {
                            await time.increase(time.duration.weeks(1).add(time.duration.seconds(1)));

                            this.aliceEthBalanceBeforeProcessExit = new BN(await web3.eth.getBalance(alice));
                            this.aliceErc20BalanceBeforeProcessExit = new BN(await this.erc20.balanceOf(alice));

                            await this.framework.processExits(this.erc20.address, 0, 1);
                        });

                        it('should return the standard exit bond in ETH to alice', async () => {
                            const actualAliceEthBalanceAfterProcessExit = new BN(await web3.eth.getBalance(alice));
                            const expectedAliceEthBalance = this.aliceEthBalanceBeforeProcessExit
                                .add(new BN(STANDARD_EXIT_BOND));

                            expect(actualAliceEthBalanceAfterProcessExit)
                                .to.be.bignumber.equal(expectedAliceEthBalance);
                        });

                        it('should return ERC20 token with deposited amount to alice', async () => {
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
