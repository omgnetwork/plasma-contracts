const PaymentExitGame = artifacts.require('PaymentExitGame');
const PlasmaFramework = artifacts.require('PlasmaFramework');
const Liquidity = artifacts.require('../Liquidity');
const ExitableTimestamp = artifacts.require('ExitableTimestampWrapper');
const ExitPriority = artifacts.require('ExitPriorityWrapper');
const EthVault = artifacts.require('EthVault');

const {
    BN, constants, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { MerkleTree } = require('../helpers/merkle.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../helpers/transaction.js');
const { computeNormalOutputId } = require('../helpers/utils.js');
const { buildUtxoPos } = require('../helpers/positions.js');
const Testlang = require('../helpers/testlang.js');
const config = require('../../config.js');

contract(
    'LiquidityContract - Fast Exits - End to End Tests',
    ([_deployer, _maintainer, authority, bob, richFather]) => {
        const ETH = constants.ZERO_ADDRESS;
        const OUTPUT_TYPE_PAYMENT = config.registerKeys.outputTypes.payment;
        const DEPOSIT_VALUE = 1000000;
        const MERKLE_TREE_DEPTH = 16;
        const TRANSFER_AMOUNT = 1000;

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
            this.exitableHelper = await ExitableTimestamp.new(config.frameworks.minExitPeriod);
        };

        before(async () => {
            await Promise.all([setupAccount(), deployStableContracts()]);
        });

        const setupContracts = async () => {
            this.framework = await PlasmaFramework.deployed();

            this.ethVault = await EthVault.at(await this.framework.vaults(config.registerKeys.vaultId.eth));

            this.exitGame = await PaymentExitGame.at(
                await this.framework.exitGames(config.registerKeys.txTypes.payment),
            );

            this.startStandardExitBondSize = await this.exitGame.startStandardExitBondSize();

            this.framework.addExitQueue(config.registerKeys.vaultId.eth, ETH);

            this.liquidity = await Liquidity.new(this.framework.address, { from: authority });
        };

        const aliceDepositsETH = async () => {
            const depositBlockNum = (await this.framework.nextDepositBlock()).toNumber();
            this.depositUtxoPos = buildUtxoPos(depositBlockNum, 0, 0);
            this.depositTx = Testlang.deposit(OUTPUT_TYPE_PAYMENT, DEPOSIT_VALUE, alice);
            this.merkleTreeForDepositTx = new MerkleTree([this.depositTx], MERKLE_TREE_DEPTH);
            this.merkleProofForDepositTx = this.merkleTreeForDepositTx.getInclusionProof(this.depositTx);

            return this.ethVault.deposit(this.depositTx, { from: alice, value: DEPOSIT_VALUE });
        };

        const aliceTransferSomeEthToLC = async () => {
            const tranferTxBlockNum = (await this.framework.nextChildBlock()).toNumber();
            this.transferUtxoPos = buildUtxoPos(tranferTxBlockNum, 0, 0);

            const outputLC = new PaymentTransactionOutput(
                OUTPUT_TYPE_PAYMENT,
                TRANSFER_AMOUNT,
                this.liquidity.address,
                ETH,
            );
            const outputAlice = new PaymentTransactionOutput(
                OUTPUT_TYPE_PAYMENT,
                DEPOSIT_VALUE - TRANSFER_AMOUNT,
                alice,
                ETH,
            );
            this.transferTxObject = new PaymentTransaction(1, [this.depositUtxoPos], [outputLC, outputAlice]);
            this.transferTx = web3.utils.bytesToHex(this.transferTxObject.rlpEncoded());
            this.merkleTreeForTransferTx = new MerkleTree([this.transferTx]);
            this.merkleProofForTransferTx = this.merkleTreeForTransferTx.getInclusionProof(this.transferTx);

            await this.framework.submitBlock(this.merkleTreeForTransferTx.root, { from: authority });
        };

        describe('Given contracts deployed, exit game and ETH vault registered', () => {
            before(setupContracts);

            describe('Given Alice deposited ETH and transferred some value to the Liquidity Contract', () => {
                before(async () => {
                    this.aliceBalanceBeforeDeposit = new BN(await web3.eth.getBalance(alice));
                    this.ethVaultBalanceBeforeDeposit = new BN(await web3.eth.getBalance(this.ethVault.address));
                    const { receipt } = await aliceDepositsETH();
                    this.aliceDepositReceipt = receipt;
                    await aliceTransferSomeEthToLC();
                });

                describe('When Bob tries to start the exit from the UTXO created by Alice', () => {
                    it('should not allow Bob to start the exit', async () => {
                        const utxoPos = this.transferUtxoPos;
                        const rlpOutputTx = this.transferTx;
                        const outputTxInclusionProof = this.merkleProofForTransferTx;
                        const { depositUtxoPos } = this;
                        const rlpDepositTx = this.depositTx;
                        const depositInclusionProof = this.merkleProofForDepositTx;

                        await expectRevert(
                            this.liquidity.startExit(
                                utxoPos,
                                rlpOutputTx,
                                outputTxInclusionProof,
                                rlpDepositTx,
                                depositInclusionProof,
                                depositUtxoPos,
                                { from: bob, value: this.startStandardExitBondSize },
                            ),
                            'Was not called by the first Tx owner',
                        );
                    });
                });

                describe('When Alice tries to start the exit with a fake transaction', () => {
                    it('should not allow to start exit', async () => {
                        const utxoPos = this.transferUtxoPos;
                        const rlpOutputTx = this.transferTx;
                        const outputTxInclusionProof = this.merkleProofForTransferTx;
                        const { depositUtxoPos } = this;
                        const rlpDepositTx = this.depositTx;
                        const depositInclusionProof = this.merkleProofForTransferTx;

                        await expectRevert(
                            this.liquidity.startExit(
                                utxoPos,
                                rlpOutputTx,
                                outputTxInclusionProof,
                                rlpDepositTx,
                                depositInclusionProof,
                                depositUtxoPos,
                                { from: alice, value: this.startStandardExitBondSize },
                            ),
                            "Provided Transaction isn't finalized or doesn't exist",
                        );
                    });
                });

                describe('When Alice tries to start the standard exit from the Liquidity Contract with all valid proofs', () => {
                    before(async () => {
                        const utxoPos = this.transferUtxoPos;
                        const rlpOutputTx = this.transferTx;
                        const outputTxInclusionProof = this.merkleProofForTransferTx;
                        const { depositUtxoPos } = this;
                        const rlpDepositTx = this.depositTx;
                        const depositInclusionProof = this.merkleProofForDepositTx;

                        await this.liquidity.startExit(
                            utxoPos,
                            rlpOutputTx,
                            outputTxInclusionProof,
                            rlpDepositTx,
                            depositInclusionProof,
                            depositUtxoPos,
                            { from: alice, value: this.startStandardExitBondSize },
                        );
                    });
                    it('should start the exit successully', async () => {
                        const exitId = await this.exitGame.getStandardExitId(
                            false,
                            this.transferTx,
                            this.transferUtxoPos,
                        );
                        const exitIds = [exitId];
                        const standardExitData = (await this.exitGame.standardExits(exitIds))[0];
                        const outputIndexForTransfer = 0;
                        const outputId = computeNormalOutputId(
                            this.transferTx,
                            outputIndexForTransfer,
                            this.transferUtxoPos,
                        );

                        expect(standardExitData.exitable).to.be.true;
                        expect(standardExitData.outputId).to.equal(outputId);
                        expect(new BN(standardExitData.utxoPos)).to.be.bignumber.equal(new BN(this.transferUtxoPos));
                        expect(standardExitData.exitTarget).to.equal(this.liquidity.address);
                        expect(new BN(standardExitData.amount)).to.be.bignumber.equal(new BN(TRANSFER_AMOUNT));

                        expect(standardExitData.exitable).to.be.true;
                    });
                    it('should not allow to start from the same utxo again', async () => {
                        const utxoPos = this.transferUtxoPos;
                        const rlpOutputTx = this.transferTx;
                        const outputTxInclusionProof = this.merkleProofForTransferTx;
                        const { depositUtxoPos } = this;
                        const rlpDepositTx = this.depositTx;
                        const depositInclusionProof = this.merkleProofForDepositTx;

                        await expectRevert(
                            this.liquidity.startExit(
                                utxoPos,
                                rlpOutputTx,
                                outputTxInclusionProof,
                                rlpDepositTx,
                                depositInclusionProof,
                                depositUtxoPos,
                                { from: alice, value: this.startStandardExitBondSize },
                            ),
                            'Exit has already started.',
                        );
                    });

                    describe('And then Alice processes the exits after two weeks', () => {
                        before(async () => {
                            await time.increase(time.duration.weeks(2).add(time.duration.seconds(1)));

                            this.LCBalanceBeforeProcessExit = new BN(await web3.eth.getBalance(this.liquidity.address));

                            await this.framework.processExits(config.registerKeys.vaultId.eth, ETH, 0, 1, {
                                from: alice,
                            });
                        });

                        it('should return the output amount plus standard exit bond to the Liquidity Contract', async () => {
                            const actualLCBalanceAfterProcessExit = new BN(
                                await web3.eth.getBalance(this.liquidity.address),
                            );
                            const expectedLCBalance = this.LCBalanceBeforeProcessExit.add(
                                this.startStandardExitBondSize,
                            ).add(new BN(this.transferTxObject.outputs[0].amount));

                            expect(actualLCBalanceAfterProcessExit).to.be.bignumber.equal(expectedLCBalance);
                        });
                    });
                });
            });
        });
    },
);
