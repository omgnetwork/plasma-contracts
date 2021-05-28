const PaymentExitGame = artifacts.require('PaymentExitGame');
const PlasmaFramework = artifacts.require('PlasmaFramework');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const Quasar = artifacts.require('Quasar');
const QToken = artifacts.require('QToken');
const EthVault = artifacts.require('EthVault');
const Erc20Vault = artifacts.require('Erc20Vault');
const ERC20Mintable = artifacts.require('ERC20Mintable');

const {
    BN, constants, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { MerkleTree } = require('../helpers/merkle.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../helpers/transaction.js');
const { spentOnGas } = require('../helpers/utils.js');
const { buildUtxoPos } = require('../helpers/positions.js');
const { sign } = require('../helpers/sign.js');
const { hashTx } = require('../helpers/paymentEip712.js');
const Testlang = require('../helpers/testlang.js');
const config = require('../../config.js');

contract(
    'QuasarContract - Fast Exits - End to End Tests',
    ([_deployer, _maintainer, authority, bob, richDad, quasarMaintainer, quasarOwner, carol, dave]) => {
        const ETH = constants.ZERO_ADDRESS;
        const OUTPUT_TYPE_PAYMENT = config.registerKeys.outputTypes.payment;
        const INITIAL_ERC20_SUPPLY = 10000000000;
        const DEPOSIT_VALUE = 1000000;
        const QUASAR_LIQUID_FUNDS = 3000000;
        const MERKLE_TREE_DEPTH = 16;
        const INITIAL_SAFE_BLOCK_MARGIN = 5;
        const DUMMY_BLOCK_HASH = web3.utils.sha3('dummy root');

        const alicePrivateKey = '0x7151e5dab6f8e95b5436515b83f423c4df64fe4c6149f864daa209b26adb10ca';
        let alice;

        const setupAccount = async () => {
            const password = 'password1234';
            alice = await web3.eth.personal.importRawKey(alicePrivateKey, password);
            alice = web3.utils.toChecksumAddress(alice);
            web3.eth.personal.unlockAccount(alice, password, 3600);
            web3.eth.sendTransaction({ to: alice, from: richDad, value: web3.utils.toWei('2', 'ether') });
        };

        const deployStableContracts = async () => {
            this.erc20 = await ERC20Mintable.new();
            await this.erc20.mint(richDad, INITIAL_ERC20_SUPPLY);
        };

        before(async () => {
            await Promise.all([setupAccount(), deployStableContracts()]);
        });

        const submitPlasmaBlock = async () => {
            await this.framework.submitBlock(DUMMY_BLOCK_HASH, { from: authority });
        };

        const setupContracts = async () => {
            this.framework = await PlasmaFramework.deployed();
            this.spendingConditionRegistry = await SpendingConditionRegistry.deployed();
            this.ethVault = await EthVault.at(await this.framework.vaults(config.registerKeys.vaultId.eth));
            this.erc20Vault = await Erc20Vault.at(await this.framework.vaults(config.registerKeys.vaultId.erc20));
            this.exitGame = await PaymentExitGame.at(
                await this.framework.exitGames(
                    config.registerKeys.txTypes.payment,
                ),
            );
            this.startIFEBondSize = await this.exitGame.startIFEBondSize();
            this.piggybackBondSize = await this.exitGame.piggybackBondSize();
            this.framework.addExitQueue(config.registerKeys.vaultId.eth, ETH);

            // Submit some blocks to have a safe block margin
            for (let i = 0; i < INITIAL_SAFE_BLOCK_MARGIN; i++) {
                await submitPlasmaBlock(); // eslint-disable-line no-await-in-loop
            }
        };

        const setupQuasar = async () => {
            this.dummyQuasarBondValue = 500;

            this.quasar = await Quasar.new(
                this.framework.address,
                this.spendingConditionRegistry.address,
                quasarOwner,
                INITIAL_SAFE_BLOCK_MARGIN,
                this.dummyQuasarBondValue,
                { from: quasarMaintainer },
            );
            this.ifeWaitingPeriod = await this.quasar.IFE_CLAIM_WAITING_PERIOD();
            this.qEth = await QToken.new('Quasar Ether', 'qETH', 18, this.quasar.address);
            await this.quasar.registerQToken(
                ETH,
                this.qEth.address,
                5000,
                { from: quasarMaintainer },
            );
            this.quasarFeeEth = (await this.quasar.tokenData(ETH)).quasarFee;
        };

        const calculateWithdrawAmount = async (qTokens, exchangeRate) => {
            const scaledProduct = new BN(qTokens.mul(exchangeRate));
            return scaledProduct.div(new BN('1000000000000000000'));
        };

        const aliceDepositsETH = async () => {
            const depositBlockNum = (await this.framework.nextDepositBlock()).toNumber();
            this.depositUtxoPos = buildUtxoPos(depositBlockNum, 0, 0);
            this.depositTx = Testlang.deposit(OUTPUT_TYPE_PAYMENT, DEPOSIT_VALUE, alice);
            this.merkleTreeForDepositTx = new MerkleTree([this.depositTx], MERKLE_TREE_DEPTH);
            this.merkleProofForDepositTx = this.merkleTreeForDepositTx.getInclusionProof(this.depositTx);

            return this.ethVault.deposit(this.depositTx, { from: alice, value: DEPOSIT_VALUE });
        };

        const aliceTransferEth = async (receiver, transferAmount) => {
            const tranferTxBlockNum = (await this.framework.nextChildBlock()).toNumber();
            this.transferUtxoPos = buildUtxoPos(tranferTxBlockNum, 0, 0);

            const receiverOutput = new PaymentTransactionOutput(
                OUTPUT_TYPE_PAYMENT,
                transferAmount,
                receiver,
                ETH,
            );
            const outputAlice = new PaymentTransactionOutput(
                OUTPUT_TYPE_PAYMENT, DEPOSIT_VALUE - transferAmount, alice, ETH,
            );
            if (transferAmount === DEPOSIT_VALUE) {
                this.transferTxObject = new PaymentTransaction(1, [this.depositUtxoPos], [receiverOutput]);
            } else {
                this.transferTxObject = new PaymentTransaction(1, [this.depositUtxoPos], [receiverOutput, outputAlice]);
            }
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

        const aliceTransferErc20 = async (receiver, transferAmount) => {
            const tranferTxBlockNum = (await this.framework.nextChildBlock()).toNumber();
            this.transferUtxoPos = buildUtxoPos(tranferTxBlockNum, 0, 0);

            const receiverOutput = new PaymentTransactionOutput(
                OUTPUT_TYPE_PAYMENT,
                transferAmount,
                receiver,
                this.erc20.address,
            );
            const outputAlice = new PaymentTransactionOutput(
                OUTPUT_TYPE_PAYMENT, DEPOSIT_VALUE - transferAmount, alice, this.erc20.address,
            );
            if (transferAmount === DEPOSIT_VALUE) {
                this.transferTxObject = new PaymentTransaction(1, [this.depositUtxoPos], [receiverOutput]);
            } else {
                this.transferTxObject = new PaymentTransaction(1, [this.depositUtxoPos], [receiverOutput, outputAlice]);
            }
            this.transferTx = web3.utils.bytesToHex(this.transferTxObject.rlpEncoded());
            this.merkleTreeForTransferTx = new MerkleTree([this.transferTx]);
            this.merkleProofForTransferTx = this.merkleTreeForTransferTx.getInclusionProof(this.transferTx);

            await this.framework.submitBlock(this.merkleTreeForTransferTx.root, { from: authority });
        };

        // Single Supplier
        // ---------------->
        describe('Given contracts deployed, exit game and ETH vault registered', () => {
            before(setupContracts);

            describe('And Quasar maintainer deploys and adds liquid funds to the Quasar', () => {
                before(async () => {
                    await setupQuasar();
                    this.quasarCapacityBeforeAddingFunds = new BN(await this.quasar.tokenUsableCapacity(ETH));
                    await this.quasar.addEthCapacity({ from: quasarMaintainer, value: QUASAR_LIQUID_FUNDS });
                });

                it('should increase the capacity of the Quasar', async () => {
                    const quasarCapacityAfterAddingFunds = new BN(await this.quasar.tokenUsableCapacity(ETH));
                    const quasarExpectedCapacity = this.quasarCapacityBeforeAddingFunds.addn(QUASAR_LIQUID_FUNDS);

                    expect(quasarCapacityAfterAddingFunds).to.be.bignumber.equal(
                        quasarExpectedCapacity,
                    );
                });

                describe('When Alice deposited ETH to Vault', () => {
                    before(async () => {
                        await aliceDepositsETH();
                        await submitPlasmaBlock();
                    });

                    describe('And then Alice tries to obtain a ticket from the Quasar using the output', () => {
                        describe('If the output is from block over the safe-blocknum', () => {
                            it('should not allow Alice to obtain a ticket', async () => {
                                const utxoPos = this.depositUtxoPos;
                                const rlpOutputCreationTx = this.depositTx;
                                const outputCreationTxInclusionProof = this.merkleProofForDepositTx;

                                await expectRevert(
                                    this.quasar.obtainTicket(
                                        utxoPos,
                                        rlpOutputCreationTx,
                                        outputCreationTxInclusionProof,
                                        {
                                            from: alice,
                                            value: this.dummyQuasarBondValue,
                                        },
                                    ),
                                    'Later than safe limit.',
                                );
                            });
                        });

                        describe('If the Quasar maintainer updates the safeblocknum to allow the output', () => {
                            before(async () => {
                                this.preSafeBlockMargin = await this.quasar.getSafeBlockMargin();
                                this.dummySafeBlockMargin = 1;
                                await this.quasar.setSafeBlockMargin(
                                    this.dummySafeBlockMargin,
                                    { from: quasarMaintainer },
                                );

                                // safeBlockMargin should not have updated yet.
                                const safeBlockMargin = await this.quasar.getSafeBlockMargin();
                                expect(safeBlockMargin).to.be.bignumber.equal(new BN(this.preSafeBlockMargin));

                                // Wait for the SafeBlockNumber waiting period
                                await time.increase(time.duration.weeks(1));

                                await submitPlasmaBlock();
                            });

                            it('should update the safeblocknum to the new value', async () => {
                                const safeBlockMargin = await this.quasar.getSafeBlockMargin();
                                expect(safeBlockMargin).to.be.bignumber.equal(new BN(this.dummySafeBlockMargin));
                            });

                            describe('And then if Alice tries to obtain ticket with fake transaction', () => {
                                it('should not allow Alice to obtain a ticket', async () => {
                                    const utxoPos = this.depositUtxoPos;
                                    const rlpOutputCreationTx = this.depositTx;

                                    // fake tx inclusion proof
                                    const merkleTreeForDepositTx = new MerkleTree([this.depositTx], 4);
                                    const fakeOutputCreationTxInclusionProof = merkleTreeForDepositTx.getInclusionProof(
                                        this.depositTx,
                                    );
                                    await expectRevert(
                                        this.quasar.obtainTicket(
                                            utxoPos,
                                            rlpOutputCreationTx,
                                            fakeOutputCreationTxInclusionProof,
                                            {
                                                from: alice,
                                                value: this.dummyQuasarBondValue,
                                            },
                                        ),
                                        'Tx doesn\'t exist',
                                    );
                                });
                            });

                            describe('And if Alice tries to obtain ticket with invalid bond', () => {
                                it('should not allow Alice to obtain a ticket', async () => {
                                    const utxoPos = this.depositUtxoPos;
                                    const rlpOutputCreationTx = this.depositTx;
                                    const outputCreationTxInclusionProof = this.merkleProofForDepositTx;
                                    const invalidBond = this.dummyQuasarBondValue - 1;

                                    await expectRevert(
                                        this.quasar.obtainTicket(
                                            utxoPos,
                                            rlpOutputCreationTx,
                                            outputCreationTxInclusionProof,
                                            {
                                                from: alice,
                                                value: invalidBond,
                                            },
                                        ),
                                        'Incorrect bond',
                                    );
                                });
                            });

                            describe('When Alice tries to obtain ticket with all valid parameters', () => {
                                before(async () => {
                                    const utxoPos = this.depositUtxoPos;
                                    const rlpOutputCreationTx = this.depositTx;
                                    const outputCreationTxInclusionProof = this.merkleProofForDepositTx;
                                    this.quasarCapacityBeforeObtainingTicket = new BN(
                                        await this.quasar.tokenUsableCapacity(ETH),
                                    );
                                    const { receipt } = await this.quasar.obtainTicket(
                                        utxoPos,
                                        rlpOutputCreationTx,
                                        outputCreationTxInclusionProof,
                                        {
                                            from: alice,
                                            value: this.dummyQuasarBondValue,
                                        },
                                    );
                                    this.txReceipt = receipt;
                                });

                                it('should allow Alice to obtain a ticket', async () => {
                                    const ticketData = await this.quasar.ticketData(this.depositUtxoPos);
                                    const blockInfo = await web3.eth.getBlock(this.txReceipt.blockNumber);
                                    const expectedValidityTimestamp = (new BN(blockInfo.timestamp)).addn(14400);
                                    expect(ticketData.validityTimestamp).to.be.bignumber.equal(
                                        expectedValidityTimestamp,
                                    );
                                    expect(ticketData.outputOwner).to.be.equal(alice);
                                    expect(ticketData.outputValue).to.be.bignumber.equal(new BN(DEPOSIT_VALUE));
                                    const expectedReservedAmount = new BN(DEPOSIT_VALUE - this.quasarFeeEth);
                                    expect(ticketData.reservedAmount).to.be.bignumber.equal(expectedReservedAmount);
                                    expect(ticketData.token).to.be.equal(ETH);
                                    expect(ticketData.isClaimed).to.be.false;
                                });

                                it('should reduce the Quasar capacity for ETH', async () => {
                                    const updatedQuasarCapacity = new BN(await this.quasar.tokenUsableCapacity(ETH));
                                    const expectedQuasarCapacity = this.quasarCapacityBeforeObtainingTicket.subn(
                                        DEPOSIT_VALUE - this.quasarFeeEth,
                                    );

                                    expect(updatedQuasarCapacity).to.be.bignumber.equal(expectedQuasarCapacity);
                                });

                                it('should not allow to obtain another ticket with the same output immediately', async () => {
                                    const utxoPos = this.depositUtxoPos;
                                    const rlpOutputCreationTx = this.depositTx;
                                    const outputCreationTxInclusionProof = this.merkleProofForDepositTx;

                                    await expectRevert(
                                        this.quasar.obtainTicket(
                                            utxoPos,
                                            rlpOutputCreationTx,
                                            outputCreationTxInclusionProof,
                                            {
                                                from: alice,
                                                value: this.dummyQuasarBondValue,
                                            },
                                        ),
                                        'Existing ticket',
                                    );
                                });

                                describe('And then if Alice spends the output incorrectly in a tx to the quasar owner', () => {
                                    before(async () => {
                                        await aliceTransferEth(quasarOwner, DEPOSIT_VALUE / 2);
                                    });

                                    it('should not allow Alice to start a claim', async () => {
                                        const utxoPos = this.depositUtxoPos;
                                        const utxoPosQuasarOwner = this.transferUtxoPos;
                                        const rlpTxToQuasarOwner = this.transferTx;
                                        const txToQuasarOwnerInclusionProof = this.merkleProofForTransferTx;

                                        await expectRevert(
                                            this.quasar.claim(
                                                utxoPos,
                                                utxoPosQuasarOwner,
                                                rlpTxToQuasarOwner,
                                                txToQuasarOwnerInclusionProof,
                                                {
                                                    from: alice,
                                                },
                                            ),
                                            'Wrong amount sent',
                                        );
                                    });
                                });

                                describe('If Alice spends the output correctly in a tx to the quasar owner', () => {
                                    before(async () => {
                                        await aliceTransferEth(quasarOwner, DEPOSIT_VALUE);
                                    });

                                    describe('When bob tries to start claim from Alice\'s ticket', () => {
                                        it('should not allow Bob to start a claim', async () => {
                                            const utxoPos = this.depositUtxoPos;
                                            const utxoPosQuasarOwner = this.transferUtxoPos;
                                            const rlpTxToQuasarOwner = this.transferTx;
                                            const txToQuasarOwnerInclusionProof = this.merkleProofForTransferTx;

                                            await expectRevert(
                                                this.quasar.claim(
                                                    utxoPos,
                                                    utxoPosQuasarOwner,
                                                    rlpTxToQuasarOwner,
                                                    txToQuasarOwnerInclusionProof,
                                                    {
                                                        from: bob,
                                                    },
                                                ),
                                                'Not owner.',
                                            );
                                        });
                                    });

                                    describe('When Alice tries to start claim with a fake transaction', () => {
                                        it('should not allow Alice to start a claim', async () => {
                                            const utxoPos = this.depositUtxoPos;
                                            const utxoPosQuasarOwner = this.transferUtxoPos;
                                            const rlpTxToQuasarOwner = this.transferTx;

                                            // fake tx inclusion proof
                                            const fakeTxToQuasarOwnerInclusionProof = this.merkleProofForDepositTx;

                                            await expectRevert(
                                                this.quasar.claim(
                                                    utxoPos,
                                                    utxoPosQuasarOwner,
                                                    rlpTxToQuasarOwner,
                                                    fakeTxToQuasarOwnerInclusionProof,
                                                    {
                                                        from: alice,
                                                    },
                                                ),
                                                "Tx doesn't exist",
                                            );
                                        });
                                    });

                                    describe('When Alice tries to start claim with proper parameters', () => {
                                        before(async () => {
                                            const utxoPos = this.depositUtxoPos;
                                            const utxoPosQuasarOwner = this.transferUtxoPos;
                                            const rlpTxToQuasarOwner = this.transferTx;
                                            const txToQuasarOwnerInclusionProof = this.merkleProofForTransferTx;

                                            this.aliceBalanceBeforeClaim = new BN(
                                                await web3.eth.getBalance(alice),
                                            );

                                            const { receipt } = await this.quasar.claim(
                                                utxoPos,
                                                utxoPosQuasarOwner,
                                                rlpTxToQuasarOwner,
                                                txToQuasarOwnerInclusionProof,
                                                {
                                                    from: alice,
                                                },
                                            );
                                            this.claimReceipt = receipt;
                                        });

                                        it('should allow Alice to start a claim', async () => {
                                            const ticketData = await this.quasar.ticketData(this.depositUtxoPos);
                                            expect(ticketData.isClaimed).to.be.true;
                                        });

                                        it('should return the amount plus bond to Alice', async () => {
                                            const aliceBalanceAfterClaim = new BN(
                                                await web3.eth.getBalance(alice),
                                            );
                                            const ticketData = await this.quasar.ticketData(this.depositUtxoPos);
                                            const expectedAliceBalance = this.aliceBalanceBeforeClaim
                                                .add(ticketData.reservedAmount)
                                                .addn(this.dummyQuasarBondValue)
                                                .sub(await spentOnGas(this.claimReceipt));

                                            expect(aliceBalanceAfterClaim).to.be.bignumber.equal(
                                                expectedAliceBalance,
                                            );
                                        });

                                        it('should correctly set the owed Amount for ETH', async () => {
                                            const updatedQuasarCapacity = new BN(
                                                await this.quasar.tokenUsableCapacity(ETH),
                                            );
                                            const { owedAmount } = await this.quasar.tokenData(ETH);
                                            const { poolSupply } = await this.quasar.tokenData(ETH);
                                            const expectedPoolSupply = updatedQuasarCapacity.add(owedAmount);

                                            expect(poolSupply).to.be.bignumber.equal(expectedPoolSupply);
                                        });


                                        it('should not allow to claim same ticket again', async () => {
                                            const utxoPos = this.depositUtxoPos;
                                            const utxoPosQuasarOwner = this.transferUtxoPos;
                                            const rlpTxToQuasarOwner = this.transferTx;
                                            const txToQuasarOwnerInclusionProof = this.merkleProofForTransferTx;

                                            await expectRevert(
                                                this.quasar.claim(
                                                    utxoPos,
                                                    utxoPosQuasarOwner,
                                                    rlpTxToQuasarOwner,
                                                    txToQuasarOwnerInclusionProof,
                                                    {
                                                        from: alice,
                                                    },
                                                ),
                                                'Already claimed',
                                            );
                                        });

                                        it('should not allow to obtain a ticket with same output again', async () => {
                                            const utxoPos = this.depositUtxoPos;
                                            const rlpOutputCreationTx = this.depositTx;
                                            const outputCreationTxInclusionProof = this.merkleProofForDepositTx;

                                            await expectRevert(
                                                this.quasar.obtainTicket(
                                                    utxoPos,
                                                    rlpOutputCreationTx,
                                                    outputCreationTxInclusionProof,
                                                    {
                                                        from: alice,
                                                        value: this.dummyQuasarBondValue,
                                                    },
                                                ),
                                                'Already claimed',
                                            );
                                        });

                                        describe('And Then if someone attempts to processes the claim', () => {
                                            it('should not allow to process claim again', async () => {
                                                const utxoPos = this.depositUtxoPos;
                                                await expectRevert(
                                                    this.quasar.processIfeClaim(utxoPos),
                                                    'Claim invalid',
                                                );
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });

                describe.skip('Given Alice deposited ETH to Vault and obtains a ticket for the output', () => {
                    // Skipped because the Quasar trusts the operator not to allow a double spend
                    before(async () => {
                        await aliceDepositsETH();
                        await submitPlasmaBlock();
                        await submitPlasmaBlock();

                        // Submit abother block for the safe margin
                        const utxoPos = this.depositUtxoPos;
                        const rlpOutputCreationTx = this.depositTx;
                        const outputCreationTxInclusionProof = this.merkleProofForDepositTx;
                        await this.quasar.obtainTicket(
                            utxoPos,
                            rlpOutputCreationTx,
                            outputCreationTxInclusionProof,
                            {
                                from: alice,
                                value: this.dummyQuasarBondValue,
                            },
                        );
                    });

                    describe('When Alice double spends the output to Bob and the Quasar Owner', () => {
                        before(async () => {
                            // spends output in a tx to Bob
                            await aliceTransferEth(bob, DEPOSIT_VALUE);
                            this.bobTransferTxUtxoPos = this.transferUtxoPos;
                            this.bobTransferTx = this.transferTx;
                            this.bobTransferTxObject = this.transferTxObject;
                            this.bobTransferTxMerkleProof = this.merkleProofForTransferTx;
                            // spends same output in a tx to quasarowner
                            await aliceTransferEth(quasarOwner, DEPOSIT_VALUE);
                        });

                        describe('and then Alice tries to claim with the tx to Quasar owner', () => {
                            before(async () => {
                                const utxoPos = this.depositUtxoPos;
                                const utxoPosQuasarOwner = this.transferUtxoPos;
                                const rlpTxToQuasarOwner = this.transferTx;
                                const txToQuasarOwnerInclusionProof = this.merkleProofForTransferTx;

                                await this.quasar.claim(
                                    utxoPos,
                                    utxoPosQuasarOwner,
                                    rlpTxToQuasarOwner,
                                    txToQuasarOwnerInclusionProof,
                                    {
                                        from: alice,
                                    },
                                );
                            });

                            describe('and then the Quasar Maintainer challenges the claim within waiting period', () => {
                                before(async () => {
                                    const utxoPos = this.depositUtxoPos;
                                    const rlpChallengeTx = this.bobTransferTx;
                                    const challengeTxInputIndex = 0;
                                    const txHash = hashTx(this.bobTransferTxObject, this.framework.address);
                                    const signature = sign(txHash, alicePrivateKey);
                                    const otherInputIndex = 0;
                                    const otherInputCreationTx = '0x';

                                    this.quasarMaintainerBalanceBeforeChallenge = new BN(
                                        await web3.eth.getBalance(quasarMaintainer),
                                    );
                                    this.quasarCapacityBeforeChallenge = new BN(
                                        await this.quasar.tokenUsableCapacity(ETH),
                                    );
                                    const { receipt } = await this.quasar.challengeIfeClaim(
                                        utxoPos,
                                        rlpChallengeTx,
                                        challengeTxInputIndex,
                                        signature,
                                        otherInputIndex,
                                        otherInputCreationTx,
                                        web3.utils.keccak256(quasarMaintainer),
                                        {
                                            from: quasarMaintainer,
                                        },
                                    );
                                    this.challengeTxReceipt = receipt;
                                });

                                it('should transfer bond to challenger', async () => {
                                    const quasarMaintainerBalanceAfterChallenge = new BN(
                                        await web3.eth.getBalance(quasarMaintainer),
                                    );
                                    const expectedQuasarMaintainerBalance = this.quasarMaintainerBalanceBeforeChallenge
                                        .addn(this.dummyQuasarBondValue)
                                        .sub(await spentOnGas(this.challengeTxReceipt));

                                    expect(quasarMaintainerBalanceAfterChallenge).to.be.bignumber.equal(
                                        expectedQuasarMaintainerBalance,
                                    );
                                });

                                it('should update the capacity of the Quasar', async () => {
                                    const quasarCapacityAfterChallenge = new BN(
                                        await this.quasar.tokenUsableCapacity(ETH),
                                    );
                                    const quasarExpectedCapacity = this.quasarCapacityBeforeChallenge.addn(
                                        DEPOSIT_VALUE - this.quasarFeeEth,
                                    );

                                    expect(quasarExpectedCapacity).to.be.bignumber.equal(quasarCapacityAfterChallenge);
                                });

                                it('should not allow processing Claim', async () => {
                                    // +2 seconds from last increase
                                    await time.increase(time.duration.seconds(2));
                                    const utxoPos = this.depositUtxoPos;
                                    await expectRevert(
                                        this.quasar.processIfeClaim(utxoPos),
                                        'Claim invalid',
                                    );
                                });
                            });
                        });
                    });
                });

                describe('Given Alice deposited ETH and transferred some to Bob', () => {
                    before(async () => {
                        await aliceDepositsETH();
                        await aliceTransferEth(bob, DEPOSIT_VALUE / 2);
                        await submitPlasmaBlock();
                    });

                    describe('When Bob obtains a ticket from the Quasar using the output', () => {
                        before(async () => {
                            const utxoPos = this.transferUtxoPos;
                            const rlpOutputCreationTx = this.transferTx;
                            const outputCreationTxInclusionProof = this.merkleProofForTransferTx;

                            await this.quasar.obtainTicket(
                                utxoPos,
                                rlpOutputCreationTx,
                                outputCreationTxInclusionProof,
                                {
                                    from: bob,
                                    value: this.dummyQuasarBondValue,
                                },
                            );
                        });

                        describe('When Bob tries to claim after the ticket is expired', () => {
                            before(async () => {
                                // bob sends tx to quasar owner
                                this.bobUtxoPos = this.transferUtxoPos;
                                const tranferTxBlockNum = (await this.framework.nextChildBlock()).toNumber();
                                this.transferUtxoPos = buildUtxoPos(tranferTxBlockNum, 0, 0);
                                const receiverOutput = new PaymentTransactionOutput(
                                    OUTPUT_TYPE_PAYMENT,
                                    DEPOSIT_VALUE / 2,
                                    quasarOwner,
                                    ETH,
                                );
                                this.transferTxObject = new PaymentTransaction(1, [this.bobUtxoPos], [receiverOutput]);
                                this.transferTx = web3.utils.bytesToHex(this.transferTxObject.rlpEncoded());
                                this.merkleTreeForTransferTx = new MerkleTree([this.transferTx]);
                                this.merkleProofForTransferTx = this.merkleTreeForTransferTx.getInclusionProof(
                                    this.transferTx,
                                );

                                await this.framework.submitBlock(
                                    this.merkleTreeForTransferTx.root,
                                    { from: authority },
                                );
                            });

                            it('it should not allow claim', async () => {
                                const utxoPos = this.bobUtxoPos;
                                const utxoPosQuasarOwner = this.transferUtxoPos;
                                const rlpTxToQuasarOwner = this.transferTx;
                                const txToQuasarOwnerInclusionProof = this.merkleProofForTransferTx;
                                await time.increase(time.duration.seconds(14401));
                                await expectRevert(
                                    this.quasar.claim(
                                        utxoPos,
                                        utxoPosQuasarOwner,
                                        rlpTxToQuasarOwner,
                                        txToQuasarOwnerInclusionProof,
                                        {
                                            from: bob,
                                        },
                                    ),
                                    'Invalid ticket',
                                );
                            });

                            describe('When someone flushes the expired ticket', () => {
                                before(async () => {
                                    this.quasarCapacityBeforeFlush = new BN(await this.quasar.tokenUsableCapacity(ETH));
                                    await this.quasar.flushExpiredTicket(this.bobUtxoPos);
                                });

                                it('should free the quasar capacity and add bond value to reserve', async () => {
                                    const quasarCapacityAfterFlush = new BN(await this.quasar.tokenUsableCapacity(ETH));
                                    const quasarExpectedCapacity = this.quasarCapacityBeforeFlush.addn(
                                        (DEPOSIT_VALUE / 2) - this.quasarFeeEth,
                                    );

                                    expect(quasarCapacityAfterFlush).to.be.bignumber.equal(quasarExpectedCapacity);
                                });

                                it('should not allow to flush same ticket again', async () => {
                                    await expectRevert(
                                        this.quasar.flushExpiredTicket(this.bobUtxoPos),
                                        "Can't flush",
                                    );
                                });

                                describe('When the Quasar Maintainer tries to withdraw unreserved funds plus the unclaimed bonds ', () => {
                                    // add before repay here
                                    before(async () => {
                                        const { owedAmount } = await this.quasar.tokenData(ETH);
                                        await this.quasar.repayOwedToken(ETH, 0, { value: owedAmount });
                                    });

                                    it('should not allow to withdraw if withdrawal amount is more than claimable funds', async () => {
                                        const qToken = await this.quasar.tokenData(ETH);
                                        const qETHContract = await QToken.at(qToken.qTokenAddress);
                                        this.quasarMaintainerQTokenBalance = await qETHContract.balanceOf(
                                            quasarMaintainer,
                                        );
                                        const withdrawableFunds = this.quasarMaintainerQTokenBalance.addn(1);
                                        await expectRevert(
                                            this.quasar.withdrawFunds(
                                                ETH,
                                                withdrawableFunds,
                                                { from: quasarMaintainer },
                                            ),
                                            'Not enough qTokens',
                                        );
                                    });

                                    it('should allow to withdraw all claimable funds(qTokens)', async () => {
                                        const quasarCapacity = new BN(await this.quasar.tokenUsableCapacity(ETH));
                                        const quasarContractBalance = new BN(
                                            await web3.eth.getBalance(this.quasar.address),
                                        );
                                        const quasarMaintainerBalanceBeforeWithdraw = new BN(
                                            await web3.eth.getBalance(quasarMaintainer),
                                        );

                                        expect(quasarContractBalance).to.be.bignumber.equal(
                                            quasarCapacity.addn(this.dummyQuasarBondValue),
                                        );

                                        const txUnclaimedBonds = await this.quasar.withdrawUnclaimedBonds(
                                            { from: quasarMaintainer },
                                        );

                                        const { exchangeRate } = await this.quasar.tokenData(ETH);
                                        this.qMaintainerWithdrawAmount = await calculateWithdrawAmount(
                                            this.quasarMaintainerQTokenBalance,
                                            exchangeRate,
                                        );

                                        const txEthWithdrawal = await this.quasar.withdrawFunds(
                                            ETH,
                                            this.quasarMaintainerQTokenBalance,
                                            { from: quasarMaintainer },
                                        );

                                        const qToken = await this.quasar.tokenData(ETH);
                                        const qETHContract = await QToken.at(qToken.qTokenAddress);
                                        const quasarMaintainerQTokenBalance = await qETHContract.balanceOf(
                                            quasarMaintainer,
                                        );

                                        expect(quasarMaintainerQTokenBalance).to.be.bignumber.equal(new BN(0));

                                        const quasarMaintainerBalanceAfterWithdraw = new BN(
                                            await web3.eth.getBalance(quasarMaintainer),
                                        );

                                        const expectedQuasarMaintainerBalance = quasarMaintainerBalanceBeforeWithdraw
                                            .add(this.qMaintainerWithdrawAmount)
                                            .addn(this.dummyQuasarBondValue)
                                            .sub(await spentOnGas(txUnclaimedBonds.receipt))
                                            .sub(await spentOnGas(txEthWithdrawal.receipt));

                                        expect(quasarMaintainerBalanceAfterWithdraw).to.be.bignumber.equal(
                                            expectedQuasarMaintainerBalance,
                                        );
                                    });
                                });
                            });
                        });
                    });
                });

                describe('Given Alice deposited ETH to Vault and obtains a ticket for the output', () => {
                    before(async () => {
                        await aliceDepositsETH();
                        await submitPlasmaBlock();
                        await submitPlasmaBlock();
                        await this.quasar.addEthCapacity({ from: quasarMaintainer, value: QUASAR_LIQUID_FUNDS });

                        const utxoPos = this.depositUtxoPos;
                        const rlpOutputCreationTx = this.depositTx;
                        const outputCreationTxInclusionProof = this.merkleProofForDepositTx;
                        await this.quasar.obtainTicket(
                            utxoPos,
                            rlpOutputCreationTx,
                            outputCreationTxInclusionProof,
                            {
                                from: alice,
                                value: this.dummyQuasarBondValue,
                            },
                        );
                    });
                    describe('When Alice spends the output in a tx to the Quasar Owner', () => {
                        before(async () => {
                            await aliceTransferEth(quasarOwner, DEPOSIT_VALUE);
                        });
                        describe('If the operator doesn\'t include the tx and there is no inclusion proof', () => {
                            describe('Alice starts an IFE Claim', () => {
                                it('should not allow to start an IFE claim without starting ife first', async () => {
                                    const utxoPos = this.depositUtxoPos;
                                    const rlpTxToQuasarOwner = this.transferTx;

                                    await expectRevert(
                                        this.quasar.ifeClaim(
                                            utxoPos,
                                            rlpTxToQuasarOwner,
                                            {
                                                from: alice,
                                            },
                                        ),
                                        'IFE not started',
                                    );
                                });
                            });
                            describe('Alice starts an IFE Claim within the claim period after starting an IFE on the tx', () => {
                                before(async () => {
                                    const inputTxs = [this.depositTx];
                                    const inputUtxosPos = [this.depositUtxoPos];
                                    const inputTxsInclusionProofs = [this.merkleProofForDepositTx];

                                    const txHash = hashTx(this.transferTxObject, this.framework.address);
                                    const signature = sign(txHash, alicePrivateKey);

                                    const args = {
                                        inFlightTx: this.transferTx,
                                        inputTxs,
                                        inputUtxosPos,
                                        inputTxsInclusionProofs,
                                        inFlightTxWitnesses: [signature],
                                    };

                                    await this.exitGame.startInFlightExit(
                                        args,
                                        { from: alice, value: this.startIFEBondSize },
                                    );

                                    const utxoPos = this.depositUtxoPos;
                                    const rlpTxToQuasarOwner = this.transferTx;

                                    await this.quasar.ifeClaim(
                                        utxoPos,
                                        rlpTxToQuasarOwner,
                                        {
                                            from: alice,
                                        },
                                    );
                                });

                                it('should allow Alice to start a claim', async () => {
                                    const ticketData = await this.quasar.ticketData(this.depositUtxoPos);
                                    expect(ticketData.isClaimed).to.be.true;
                                });

                                it('should not allow normal claim same ticket again', async () => {
                                    const utxoPos = this.depositUtxoPos;
                                    const utxoPosQuasarOwner = this.transferUtxoPos;
                                    const rlpTxToQuasarOwner = this.transferTx;
                                    const txToQuasarOwnerInclusionProof = this.merkleProofForTransferTx;

                                    await expectRevert(
                                        this.quasar.claim(
                                            utxoPos,
                                            utxoPosQuasarOwner,
                                            rlpTxToQuasarOwner,
                                            txToQuasarOwnerInclusionProof,
                                            {
                                                from: alice,
                                            },
                                        ),
                                        'Already claimed',
                                    );
                                });

                                it('should not allow IFE claim same ticket again', async () => {
                                    const utxoPos = this.depositUtxoPos;
                                    const rlpTxToQuasarOwner = this.transferTx;

                                    await expectRevert(
                                        this.quasar.ifeClaim(
                                            utxoPos,
                                            rlpTxToQuasarOwner,
                                            {
                                                from: alice,
                                            },
                                        ),
                                        'Already claimed',
                                    );
                                });

                                it('should not allow to obtain a ticket with same output again', async () => {
                                    const utxoPos = this.depositUtxoPos;
                                    const rlpOutputCreationTx = this.depositTx;
                                    const outputCreationTxInclusionProof = this.merkleProofForDepositTx;

                                    await expectRevert(
                                        this.quasar.obtainTicket(
                                            utxoPos,
                                            rlpOutputCreationTx,
                                            outputCreationTxInclusionProof,
                                            {
                                                from: alice,
                                                value: this.dummyQuasarBondValue,
                                            },
                                        ),
                                        'Already claimed',
                                    );
                                });

                                describe('The Quasar Owner Piggybacks the ouput of the IFE', () => {
                                    before(async () => {
                                        this.exitingOutputIndex = 0;
                                        const args = {
                                            inFlightTx: this.transferTx,
                                            outputIndex: this.exitingOutputIndex,
                                        };

                                        this.piggybackTx = await this.exitGame.piggybackInFlightExitOnOutput(
                                            args,
                                            { from: quasarOwner, value: this.piggybackBondSize },
                                        );
                                    });

                                    describe('And Then someone processes the claim after the ife waiting period', () => {
                                        it('should not allow to process before the ife waiting period', async () => {
                                            const utxoPos = this.depositUtxoPos;

                                            await expectRevert(
                                                this.quasar.processIfeClaim(
                                                    utxoPos,
                                                ),
                                                'Claim not finalized',
                                            );
                                        });

                                        describe('When the waiting period passes', () => {
                                            before(async () => {
                                                await time.increase(time.duration.seconds(this.ifeWaitingPeriod).add(
                                                    time.duration.seconds(1),
                                                ));
                                            });
                                            it('should allow to process claim and return the amount plus bond to Alice', async () => {
                                                const utxoPos = this.depositUtxoPos;
                                                const ticketData = await this.quasar.ticketData(utxoPos);
                                                const aliceBalanceBeforeprocessIfeClaim = new BN(
                                                    await web3.eth.getBalance(alice),
                                                );
                                                await this.quasar.processIfeClaim(utxoPos);
                                                const aliceBalanceAfterprocessIfeClaim = new BN(
                                                    await web3.eth.getBalance(alice),
                                                );
                                                const expectedAliceBalance = aliceBalanceBeforeprocessIfeClaim.add(
                                                    ticketData.reservedAmount,
                                                ).addn(this.dummyQuasarBondValue);

                                                expect(aliceBalanceAfterprocessIfeClaim).to.be.bignumber.equal(
                                                    expectedAliceBalance,
                                                );
                                            });

                                            it('should not allow to process claim again', async () => {
                                                const utxoPos = this.depositUtxoPos;
                                                await expectRevert(
                                                    this.quasar.processIfeClaim(utxoPos),
                                                    'Claim invalid',
                                                );
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });

                describe('Given Alice deposited ETH to Vault and obtains a ticket for the output', () => {
                    before(async () => {
                        await aliceDepositsETH();
                        await submitPlasmaBlock();
                        await submitPlasmaBlock();
                        const utxoPos = this.depositUtxoPos;
                        const rlpOutputCreationTx = this.depositTx;
                        const outputCreationTxInclusionProof = this.merkleProofForDepositTx;
                        await this.quasar.obtainTicket(
                            utxoPos,
                            rlpOutputCreationTx,
                            outputCreationTxInclusionProof,
                            {
                                from: alice,
                                value: this.dummyQuasarBondValue,
                            },
                        );
                    });

                    describe('When Alice double spends the output to Bob and the Quasar Owner', () => {
                        before(async () => {
                            // spends output in a tx to Bob
                            await aliceTransferEth(bob, DEPOSIT_VALUE);
                            this.bobTransferTxUtxoPos = this.transferUtxoPos;
                            this.bobTransferTx = this.transferTx;
                            this.bobTransferTxObject = this.transferTxObject;
                            this.bobTransferTxMerkleProof = this.merkleProofForTransferTx;
                            // spends same output in a tx to quasarowner
                            await aliceTransferEth(quasarOwner, DEPOSIT_VALUE);
                        });

                        describe('and then Alice tries to ife claim with the tx to Quasar owner', () => {
                            before(async () => {
                                const inputTxs = [this.depositTx];
                                const inputUtxosPos = [this.depositUtxoPos];
                                const inputTxsInclusionProofs = [this.merkleProofForDepositTx];

                                const txHash = hashTx(this.transferTxObject, this.framework.address);
                                const signature = sign(txHash, alicePrivateKey);

                                const args = {
                                    inFlightTx: this.transferTx,
                                    inputTxs,
                                    inputUtxosPos,
                                    inputTxsInclusionProofs,
                                    inFlightTxWitnesses: [signature],
                                };

                                await this.exitGame.startInFlightExit(
                                    args,
                                    { from: alice, value: this.startIFEBondSize },
                                );

                                const utxoPos = this.depositUtxoPos;
                                const rlpTxToQuasarOwner = this.transferTx;

                                await this.quasar.ifeClaim(
                                    utxoPos,
                                    rlpTxToQuasarOwner,
                                    {
                                        from: alice,
                                    },
                                );
                            });

                            describe('and then the Quasar Maintainer challenges the claim within waiting period', () => {
                                before(async () => {
                                    await time.increase(time.duration.seconds(this.ifeWaitingPeriod).sub(
                                        time.duration.seconds(1),
                                    ));
                                    const utxoPos = this.depositUtxoPos;
                                    const rlpChallengeTx = this.bobTransferTx;
                                    const challengeTxInputIndex = 0;

                                    const txHash = hashTx(this.bobTransferTxObject, this.framework.address);
                                    const signature = sign(txHash, alicePrivateKey);
                                    const otherInputIndex = 0;
                                    const otherInputCreationTx = '0x';

                                    this.quasarMaintainerBalanceBeforeChallenge = new BN(
                                        await web3.eth.getBalance(quasarMaintainer),
                                    );
                                    this.quasarCapacityBeforeChallenge = new BN(
                                        await this.quasar.tokenUsableCapacity(ETH),
                                    );
                                    const { receipt } = await this.quasar.challengeIfeClaim(
                                        utxoPos,
                                        rlpChallengeTx,
                                        challengeTxInputIndex,
                                        signature,
                                        otherInputIndex,
                                        otherInputCreationTx,
                                        web3.utils.keccak256(quasarMaintainer),
                                        {
                                            from: quasarMaintainer,
                                        },
                                    );
                                    this.challengeTxReceipt = receipt;
                                });

                                it('should transfer bond to challenger', async () => {
                                    const quasarMaintainerBalanceAfterChallenge = new BN(
                                        await web3.eth.getBalance(quasarMaintainer),
                                    );
                                    const expectedQuasarMaintainerBalance = this.quasarMaintainerBalanceBeforeChallenge
                                        .addn(this.dummyQuasarBondValue)
                                        .sub(await spentOnGas(this.challengeTxReceipt));

                                    expect(quasarMaintainerBalanceAfterChallenge).to.be.bignumber.equal(
                                        expectedQuasarMaintainerBalance,
                                    );
                                });

                                it('should update the capacity of the Quasar', async () => {
                                    const quasarCapacityAfterChallenge = new BN(
                                        await this.quasar.tokenUsableCapacity(ETH),
                                    );
                                    const quasarExpectedCapacity = this.quasarCapacityBeforeChallenge.addn(
                                        DEPOSIT_VALUE - this.quasarFeeEth,
                                    );

                                    expect(quasarExpectedCapacity).to.be.bignumber.equal(quasarCapacityAfterChallenge);
                                });

                                it('should not allow processing Claim', async () => {
                                    // +2 seconds from last increase
                                    await time.increase(time.duration.seconds(2));
                                    const utxoPos = this.depositUtxoPos;
                                    await expectRevert(
                                        this.quasar.processIfeClaim(utxoPos),
                                        'Claim invalid',
                                    );
                                });
                            });
                        });
                    });
                });

                describe('Given Alice deposited ETH to the Vault two times, and obtains ticket for the first output', () => {
                    before(async () => {
                        await aliceDepositsETH();
                        this.outputADepositUtxoPos = this.depositUtxoPos;
                        this.outputADepositTx = this.depositTx;
                        this.outputAInclusionProof = this.merkleProofForDepositTx;
                        await aliceDepositsETH();
                        this.outputBDepositUtxoPos = this.depositUtxoPos;
                        this.outputBDepositTx = this.depositTx;
                        this.outputBInclusionProof = this.merkleProofForDepositTx;

                        await submitPlasmaBlock();
                        await submitPlasmaBlock();

                        const utxoPos = this.outputADepositUtxoPos;
                        const rlpOutputCreationTx = this.outputADepositTx;
                        const outputCreationTxInclusionProof = this.outputAInclusionProof;
                        await this.quasar.obtainTicket(
                            utxoPos,
                            rlpOutputCreationTx,
                            outputCreationTxInclusionProof,
                            {
                                from: alice,
                                value: this.dummyQuasarBondValue,
                            },
                        );
                    });

                    describe('When Alice signs a tx1 spending output A to Quasar Owner and output B as an extra input', () => {
                        before(async () => {
                            const amount = DEPOSIT_VALUE;
                            const outputQuasarOwner = new PaymentTransactionOutput(
                                OUTPUT_TYPE_PAYMENT,
                                amount,
                                quasarOwner,
                                ETH,
                            );
                            const outputAlice = new PaymentTransactionOutput(
                                OUTPUT_TYPE_PAYMENT,
                                amount,
                                alice,
                                ETH,
                            );

                            this.tx1 = new PaymentTransaction(
                                1,
                                [this.outputADepositUtxoPos, this.outputBDepositUtxoPos],
                                [outputQuasarOwner, outputAlice],
                            );

                            const txHash = hashTx(this.tx1, this.framework.address);
                            this.signatureTx1 = sign(txHash, alicePrivateKey);
                        });

                        describe('And then Alice also signs another competing tx2 to Bob using output B as input', () => {
                            before(async () => {
                                const amount = DEPOSIT_VALUE / 2;
                                const output = new PaymentTransactionOutput(OUTPUT_TYPE_PAYMENT, amount, bob, ETH);
                                this.tx2 = new PaymentTransaction(
                                    1,
                                    [this.outputBDepositUtxoPos],
                                    [output],
                                );

                                const txHash = hashTx(this.tx2, this.framework.address);
                                this.signatureTx2 = sign(txHash, alicePrivateKey);
                            });

                            describe('And then Alice starts an IFE on tx1 and starts an IFE claim', () => {
                                before(async () => {
                                    this.tx1RlpEncoded = web3.utils.bytesToHex(this.tx1.rlpEncoded());
                                    const inputTxs = [this.outputADepositTx, this.outputBDepositTx];
                                    const inputTxTypes = [1, 1];
                                    const inputUtxosPos = [
                                        this.outputADepositUtxoPos, this.outputBDepositUtxoPos,
                                    ];
                                    const inputTxsInclusionProofs = [
                                        this.outputAInclusionProof, this.outputBInclusionProof,
                                    ];

                                    const args = {
                                        inFlightTx: this.tx1RlpEncoded,
                                        inputTxs,
                                        inputTxTypes,
                                        inputUtxosPos,
                                        inputTxsInclusionProofs,
                                        inFlightTxWitnesses: [this.signatureTx1, this.signatureTx1],
                                    };

                                    await this.exitGame.startInFlightExit(
                                        args,
                                        { from: bob, value: this.startIFEBondSize },
                                    );

                                    const utxoPos = this.outputADepositUtxoPos;
                                    const rlpTxToQuasarOwner = this.tx1RlpEncoded;

                                    await this.quasar.ifeClaim(
                                        utxoPos,
                                        rlpTxToQuasarOwner,
                                        {
                                            from: alice,
                                        },
                                    );
                                });

                                describe('and then the Quasar Maintainer challenges the claim with tx2 within waiting period', () => {
                                    before(async () => {
                                        await time.increase(time.duration.seconds(this.ifeWaitingPeriod).sub(
                                            time.duration.seconds(1),
                                        ));
                                        const utxoPos = this.outputADepositUtxoPos;
                                        this.tx2RlpEncoded = web3.utils.bytesToHex(this.tx2.rlpEncoded());
                                        const rlpChallengeTx = this.tx2RlpEncoded;
                                        const challengeTxInputIndex = 0;
                                        const otherInputIndex = 1;
                                        const otherInputCreationTx = this.outputBDepositTx;

                                        this.quasarMaintainerBalanceBeforeChallenge = new BN(
                                            await web3.eth.getBalance(quasarMaintainer),
                                        );
                                        this.quasarCapacityBeforeChallenge = new BN(
                                            await this.quasar.tokenUsableCapacity(ETH),
                                        );
                                        const { receipt } = await this.quasar.challengeIfeClaim(
                                            utxoPos,
                                            rlpChallengeTx,
                                            challengeTxInputIndex,
                                            this.signatureTx2,
                                            otherInputIndex,
                                            otherInputCreationTx,
                                            web3.utils.keccak256(quasarMaintainer),
                                            {
                                                from: quasarMaintainer,
                                            },
                                        );
                                        this.challengeTxReceipt = receipt;
                                    });

                                    it('should transfer bond to challenger', async () => {
                                        const quasarMaintainerBalanceAfterChallenge = new BN(
                                            await web3.eth.getBalance(quasarMaintainer),
                                        );
                                        const expectedBalance = this.quasarMaintainerBalanceBeforeChallenge
                                            .addn(this.dummyQuasarBondValue)
                                            .sub(await spentOnGas(this.challengeTxReceipt));

                                        expect(quasarMaintainerBalanceAfterChallenge).to.be.bignumber.equal(
                                            expectedBalance,
                                        );
                                    });

                                    it('should update the capacity of the Quasar', async () => {
                                        const quasarCapacityAfterChallenge = new BN(
                                            await this.quasar.tokenUsableCapacity(ETH),
                                        );
                                        const quasarExpectedCapacity = this.quasarCapacityBeforeChallenge.addn(
                                            DEPOSIT_VALUE - this.quasarFeeEth,
                                        );

                                        expect(quasarExpectedCapacity).to.be.bignumber.equal(
                                            quasarCapacityAfterChallenge,
                                        );
                                    });

                                    it('should not allow processing Claim', async () => {
                                        // +2 seconds from last increase
                                        await time.increase(time.duration.seconds(2));
                                        const utxoPos = this.outputADepositUtxoPos;
                                        await expectRevert(
                                            this.quasar.processIfeClaim(utxoPos),
                                            'Claim invalid',
                                        );
                                    });
                                });
                            });
                        });
                    });
                });

                describe('When Quasar maintainer adds liquid erc20 funds to the Quasar', () => {
                    before(async () => {
                        await setupQuasar();
                        // deploy and register qErc20
                        this.qErc20 = await QToken.new('Quasar Token', 'qERC', 18, this.quasar.address);
                        await this.quasar.registerQToken(
                            this.erc20.address,
                            this.qErc20.address,
                            5000,
                            { from: quasarMaintainer },
                        );
                        this.quasarFeeErc = (await this.quasar.tokenData(this.erc20.address)).quasarFee;

                        this.quasarCapacityBeforeAddingFunds = new BN(
                            await this.quasar.tokenUsableCapacity(this.erc20.address),
                        );
                        await this.erc20.transfer(quasarMaintainer, QUASAR_LIQUID_FUNDS, { from: richDad });
                        await this.erc20.approve(this.quasar.address, QUASAR_LIQUID_FUNDS, { from: quasarMaintainer });
                        await this.quasar.addTokenCapacity(
                            this.erc20.address, QUASAR_LIQUID_FUNDS, { from: quasarMaintainer },
                        );
                    });

                    it('should increase the capacity of the Quasar', async () => {
                        const quasarCapacityAfterAddingFunds = new BN(
                            await this.quasar.tokenUsableCapacity(this.erc20.address),
                        );
                        const quasarExpectedCapacity = this.quasarCapacityBeforeAddingFunds.addn(QUASAR_LIQUID_FUNDS);

                        expect(quasarCapacityAfterAddingFunds).to.be.bignumber.equal(
                            quasarExpectedCapacity,
                        );
                    });

                    describe('When Alice deposited Erc20 to Vault', () => {
                        before(async () => {
                            await this.erc20.transfer(alice, DEPOSIT_VALUE, { from: richDad });
                            await this.erc20.approve(this.erc20Vault.address, DEPOSIT_VALUE, { from: alice });
                            await aliceDepositsErc20();
                        });

                        describe('And then Alice tries to obtain a ticket from the Quasar using the output', () => {
                            describe('If the Quasar maintainer updates the safeblocknum to allow the output', () => {
                                before(async () => {
                                    this.preSafeBlockMargin = await this.quasar.getSafeBlockMargin();
                                    this.dummySafeBlockMargin = 1;
                                    await this.quasar.setSafeBlockMargin(
                                        this.dummySafeBlockMargin,
                                        { from: quasarMaintainer },
                                    );

                                    // Wait for the SafeBlockNumber waiting period
                                    await time.increase(time.duration.weeks(1));

                                    await submitPlasmaBlock();
                                    await submitPlasmaBlock();
                                });

                                describe('When Alice tries to obtain ticket with all valid parameters', () => {
                                    before(async () => {
                                        const utxoPos = this.depositUtxoPos;
                                        const rlpOutputCreationTx = this.depositTx;
                                        const outputCreationTxInclusionProof = this.merkleProofForDepositTx;
                                        this.quasarCapacityBeforeObtainingTicket = new BN(
                                            await this.quasar.tokenUsableCapacity(this.erc20.address),
                                        );
                                        const { receipt } = await this.quasar.obtainTicket(
                                            utxoPos,
                                            rlpOutputCreationTx,
                                            outputCreationTxInclusionProof,
                                            {
                                                from: alice,
                                                value: this.dummyQuasarBondValue,
                                            },
                                        );
                                        this.txReceipt = receipt;
                                    });

                                    it('should allow Alice to obtain a ticket', async () => {
                                        const ticketData = await this.quasar.ticketData(this.depositUtxoPos);
                                        const blockInfo = await web3.eth.getBlock(this.txReceipt.blockNumber);
                                        const expectedValidityTimestamp = (new BN(blockInfo.timestamp)).addn(14400);
                                        expect(ticketData.validityTimestamp).to.be.bignumber.equal(
                                            expectedValidityTimestamp,
                                        );
                                        expect(ticketData.outputOwner).to.be.equal(alice);
                                        expect(ticketData.outputValue).to.be.bignumber.equal(new BN(DEPOSIT_VALUE));
                                        const expectedReservedAmount = new BN(DEPOSIT_VALUE - this.quasarFeeErc);
                                        expect(ticketData.reservedAmount).to.be.bignumber.equal(expectedReservedAmount);
                                        expect(ticketData.token).to.be.equal(this.erc20.address);
                                        expect(ticketData.isClaimed).to.be.false;
                                    });

                                    it('should reduce the Quasar capacity for Erc20', async () => {
                                        const updatedQuasarCapacity = new BN(
                                            await this.quasar.tokenUsableCapacity(this.erc20.address),
                                        );
                                        const expectedQuasarCapacity = this.quasarCapacityBeforeObtainingTicket.subn(
                                            DEPOSIT_VALUE - this.quasarFeeErc,
                                        );

                                        expect(updatedQuasarCapacity).to.be.bignumber.equal(expectedQuasarCapacity);
                                    });

                                    describe('And then if Alice spends a different output of other token in a tx to the quasar owner', () => {
                                        before(async () => {
                                            await aliceTransferEth(quasarOwner, DEPOSIT_VALUE);
                                        });

                                        it('should not allow Alice to start a claim', async () => {
                                            const utxoPos = this.depositUtxoPos;
                                            const utxoPosQuasarOwner = this.transferUtxoPos;
                                            const rlpTxToQuasarOwner = this.transferTx;
                                            const txToQuasarOwnerInclusionProof = this.merkleProofForTransferTx;

                                            await expectRevert(
                                                this.quasar.claim(
                                                    utxoPos,
                                                    utxoPosQuasarOwner,
                                                    rlpTxToQuasarOwner,
                                                    txToQuasarOwnerInclusionProof,
                                                    {
                                                        from: alice,
                                                    },
                                                ),
                                                'Wrong token sent',
                                            );
                                        });
                                    });

                                    describe('If Alice spends the output correctly in a tx to the quasar owner', () => {
                                        before(async () => {
                                            await aliceTransferErc20(quasarOwner, DEPOSIT_VALUE);
                                        });

                                        describe('When Alice tries to claim with proper parameters', () => {
                                            before(async () => {
                                                const utxoPos = this.depositUtxoPos;
                                                const utxoPosQuasarOwner = this.transferUtxoPos;
                                                const rlpTxToQuasarOwner = this.transferTx;
                                                const txToQuasarOwnerInclusionProof = this.merkleProofForTransferTx;

                                                this.ethBalanceBeforeClaim = new BN(
                                                    await web3.eth.getBalance(alice),
                                                );
                                                this.erc20BalanceBeforeClaim = new BN(
                                                    await this.erc20.balanceOf(alice),
                                                );

                                                const { receipt } = await this.quasar.claim(
                                                    utxoPos,
                                                    utxoPosQuasarOwner,
                                                    rlpTxToQuasarOwner,
                                                    txToQuasarOwnerInclusionProof,
                                                    {
                                                        from: alice,
                                                    },
                                                );
                                                this.claimReceipt = receipt;
                                            });

                                            it('should allow Alice to claim', async () => {
                                                const ticketData = await this.quasar.ticketData(this.depositUtxoPos);
                                                expect(ticketData.isClaimed).to.be.true;

                                                const ethBalanceAfterClaim = new BN(
                                                    await web3.eth.getBalance(alice),
                                                );
                                                const erc20BalanceAfterClaim = new BN(
                                                    await this.erc20.balanceOf(alice),
                                                );
                                                const expectedEthBalance = this.ethBalanceBeforeClaim
                                                    .addn(this.dummyQuasarBondValue)
                                                    .sub(await spentOnGas(this.claimReceipt));
                                                const expectedErc20Balance = this.erc20BalanceBeforeClaim
                                                    .add(ticketData.reservedAmount);

                                                expect(ethBalanceAfterClaim).to.be.bignumber.equal(
                                                    expectedEthBalance,
                                                );
                                                expect(erc20BalanceAfterClaim).to.be.bignumber.equal(
                                                    expectedErc20Balance,
                                                );
                                            });
                                            it('should not allow to process the claim', async () => {
                                                const utxoPos = this.depositUtxoPos;
                                                await expectRevert(
                                                    this.quasar.processIfeClaim(utxoPos),
                                                    'Claim invalid',
                                                );
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });

                // Multiple Suppliers
                // ------------------->
                /**
                 * Scenario -
                 * Bob and Carol supply ETH to the pool
                 * After one round of claim, withdraw at the same time
                */
                describe('Scenario: Two suppliers, different supply amount', () => {
                    describe('When Bob and Carol supply ETH to the pool', () => {
                        before(async () => {
                            this.quasarCapacityBeforeAddingFunds = new BN(await this.quasar.tokenUsableCapacity(ETH));
                            this.bobSuppliedFunds = 1000000;
                            this.carolSuppliedFunds = 2000000;
                            await this.quasar.addEthCapacity({ from: bob, value: this.bobSuppliedFunds });
                            await this.quasar.addEthCapacity({ from: carol, value: this.carolSuppliedFunds });
                        });

                        it('should increase the capacity of the Quasar', async () => {
                            const quasarCapacityAfterAddingFunds = new BN(await this.quasar.tokenUsableCapacity(ETH));
                            const quasarExpectedCapacity = this.quasarCapacityBeforeAddingFunds.addn(
                                this.bobSuppliedFunds,
                            ).addn(this.carolSuppliedFunds);

                            expect(quasarCapacityAfterAddingFunds).to.be.bignumber.equal(
                                quasarExpectedCapacity,
                            );

                            const quasarBalance = new BN(await web3.eth.getBalance(this.quasar.address));
                            expect(quasarBalance).to.be.bignumber.equal(quasarCapacityAfterAddingFunds);
                        });

                        describe('Given Alice deposited ETH to Vault and obtains a ticket for the output', () => {
                            before(async () => {
                                await aliceDepositsETH();
                                await submitPlasmaBlock();
                                await submitPlasmaBlock();

                                // Submit abother block for the safe margin
                                const utxoPos = this.depositUtxoPos;
                                const rlpOutputCreationTx = this.depositTx;
                                const outputCreationTxInclusionProof = this.merkleProofForDepositTx;
                                this.quasarCapacityBeforeTicket = new BN(await this.quasar.tokenUsableCapacity(ETH));
                                await this.quasar.obtainTicket(
                                    utxoPos,
                                    rlpOutputCreationTx,
                                    outputCreationTxInclusionProof,
                                    {
                                        from: alice,
                                        value: this.dummyQuasarBondValue,
                                    },
                                );
                            });

                            describe('When Alice claims the ticket with the Tx to quasar owner', () => {
                                before(async () => {
                                    await aliceTransferEth(quasarOwner, DEPOSIT_VALUE);
                                    const utxoPos = this.depositUtxoPos;
                                    const utxoPosQuasarOwner = this.transferUtxoPos;
                                    const rlpTxToQuasarOwner = this.transferTx;
                                    const txToQuasarOwnerInclusionProof = this.merkleProofForTransferTx;

                                    this.aliceBalanceBeforeClaim = new BN(
                                        await web3.eth.getBalance(alice),
                                    );
                                    this.reservedAmount = (await this.quasar.ticketData(utxoPos)).reservedAmount;
                                    this.poolSupplyBeforeClaim = (await this.quasar.tokenData(ETH)).poolSupply;
                                    this.exchangeRateBeforeClaim = (await this.quasar.tokenData(ETH)).exchangeRate;

                                    const { receipt } = await this.quasar.claim(
                                        utxoPos,
                                        utxoPosQuasarOwner,
                                        rlpTxToQuasarOwner,
                                        txToQuasarOwnerInclusionProof,
                                        {
                                            from: alice,
                                        },
                                    );
                                    this.claimReceipt = receipt;
                                });

                                it('should update the owed capacity and usable capacity', async () => {
                                    const quasarCapacityAfterClaim = new BN(await this.quasar.tokenUsableCapacity(ETH));
                                    const expectedQuasarCapacity = this.quasarCapacityBeforeObtainingTicket.sub(
                                        this.reservedAmount,
                                    );

                                    expect(quasarCapacityAfterClaim).to.be.bignumber.equal(expectedQuasarCapacity);

                                    const { owedAmount } = await this.quasar.tokenData(ETH);
                                    const { outputValue } = await this.quasar.ticketData(this.depositUtxoPos);

                                    expect(owedAmount).to.be.bignumber.equal(outputValue);
                                });

                                it('should update the projected pool supply to include the fee', async () => {
                                    const { poolSupply: poolSupplyAfterClaim, quasarFee } = await this.quasar.tokenData(
                                        ETH,
                                    );
                                    const expectedPoolSupply = this.poolSupplyBeforeClaim.add(quasarFee);

                                    expect(poolSupplyAfterClaim).to.be.bignumber.equal(expectedPoolSupply);
                                });

                                it('should update the exchange Rate for ETH', async () => {
                                    const { exchangeRate: exchangeRateAfterClaim } = await this.quasar.tokenData(ETH);

                                    expect(exchangeRateAfterClaim).to.be.bignumber.above(this.exchangeRateBeforeClaim);
                                });

                                describe('When the quasar Maintainer repays the pool', () => {
                                    before(async () => {
                                        this.owedAmountBeforeRepayment = (await this.quasar.tokenData(ETH)).owedAmount;
                                        await this.quasar.repayOwedToken(
                                            ETH,
                                            0,
                                            { from: quasarMaintainer, value: this.owedAmountBeforeRepayment },
                                        );
                                    });

                                    it('should clear the owed amount', async () => {
                                        const { owedAmount: owedAmountAfterRepayment } = await this.quasar.tokenData(
                                            ETH,
                                        );

                                        expect(owedAmountAfterRepayment).to.be.bignumber.equal(new BN(0));
                                    });

                                    describe('If both Bob and Carol now wish to withdraw funds from the pool', () => {
                                        before(async () => {
                                            this.bobBalanceBeforeWithdraw = new BN(await web3.eth.getBalance(bob));
                                            this.carolBalanceBeforeWithdraw = new BN(await web3.eth.getBalance(carol));
                                            this.bobQTokenBalance = await this.qEth.balanceOf(bob);
                                            this.carolQTokenBalance = await this.qEth.balanceOf(carol);

                                            const { exchangeRate } = await this.quasar.tokenData(ETH);
                                            this.bobWithdrawAmount = await calculateWithdrawAmount(
                                                this.bobQTokenBalance,
                                                exchangeRate,
                                            );

                                            this.carolWithdrawAmount = await calculateWithdrawAmount(
                                                this.carolQTokenBalance,
                                                exchangeRate,
                                            );

                                            this.bobWithdrawTx = await this.quasar.withdrawFunds(
                                                ETH,
                                                this.bobQTokenBalance,
                                                { from: bob },
                                            );

                                            this.carolWithdrawTx = await this.quasar.withdrawFunds(
                                                ETH,
                                                this.carolQTokenBalance,
                                                { from: carol },
                                            );
                                        });

                                        it('should be able to withdraw all qTokens', async () => {
                                            const bobQTokenBalanceAfterWithdraw = await this.qEth.balanceOf(bob);
                                            const carolQTokenBalanceAfterWithdraw = await this.qEth.balanceOf(carol);

                                            expect(bobQTokenBalanceAfterWithdraw).to.be.bignumber.equal(new BN(0));
                                            expect(carolQTokenBalanceAfterWithdraw).to.be.bignumber.equal(new BN(0));
                                        });

                                        it('should update the quasar capacity and balance', async () => {
                                            const quasarCapacityAfterWithdraw = new BN(
                                                await this.quasar.tokenUsableCapacity(ETH),
                                            );
                                            const quasarBalance = new BN(
                                                await web3.eth.getBalance(this.quasar.address),
                                            );
                                            const { poolSupply } = await this.quasar.tokenData(ETH);

                                            expect(quasarCapacityAfterWithdraw).to.be.bignumber.equal(
                                                quasarBalance,
                                            ).equal(poolSupply);

                                            // some residue might remain in the pool
                                            // due to rounding down while withdrawing
                                            // expect the residue to be very small
                                            expect(quasarBalance).to.be.bignumber.at.most(
                                                new BN(10),
                                            ).at.least(new BN(0));
                                        });

                                        it('should distribute returns in accordance with the supplied amount', async () => {
                                            const bobBalanceAfterWithdraw = new BN(await web3.eth.getBalance(bob));
                                            const carolBalanceAfterWithdraw = new BN(await web3.eth.getBalance(carol));

                                            const bobReturnProfit = bobBalanceAfterWithdraw.add(
                                                await spentOnGas(this.bobWithdrawTx.receipt),
                                            ).sub(this.bobBalanceBeforeWithdraw).subn(this.bobSuppliedFunds);

                                            const expectedBobReturnProfit = this.bobWithdrawAmount.subn(
                                                this.bobSuppliedFunds,
                                            );
                                            expect(bobReturnProfit).to.be.bignumber.equal(expectedBobReturnProfit);

                                            const carolReturnProfit = carolBalanceAfterWithdraw.add(
                                                await spentOnGas(this.carolWithdrawTx.receipt),
                                            ).sub(this.carolBalanceBeforeWithdraw).subn(this.carolSuppliedFunds);

                                            const expectedCarolReturnProfit = this.carolWithdrawAmount.subn(
                                                this.carolSuppliedFunds,
                                            );
                                            expect(carolReturnProfit).to.be.bignumber.equal(expectedCarolReturnProfit);

                                            expect(carolReturnProfit).be.bignumber.above(bobReturnProfit);
                                        });
                                    });
                                });
                            });
                        });
                    });
                });

                /**
                 * Scenario -
                 * Bob and Carol supply ETH to the pool
                 * After one round of claim, Bob withdraws and Dave supplies
                 * After second round of claim, Dave and Carol both withdraw
                */
                describe('Scenario: Three suppliers, different entry point', () => {
                    describe('When Bob and Carol supply ETH to the pool', () => {
                        before(async () => {
                            this.quasarCapacityBeforeAddingFunds = new BN(await this.quasar.tokenUsableCapacity(ETH));
                            this.poolSupply = (await this.quasar.tokenData(ETH)).poolSupply;
                            this.quasarBalance = new BN(await web3.eth.getBalance(this.quasar.address));
                            this.bobSuppliedFunds = 1000000;
                            this.carolSuppliedFunds = 1000000;
                            this.daveSuppliedFunds = 1000000;
                            await this.quasar.addEthCapacity({ from: bob, value: this.bobSuppliedFunds });
                            await this.quasar.addEthCapacity({ from: carol, value: this.carolSuppliedFunds });
                        });

                        it('should update the quasar capacity', async () => {
                            const quasarCapacityAfterAddingFunds = new BN(await this.quasar.tokenUsableCapacity(ETH));

                            const expectedQuasarCapacity = this.quasarCapacityBeforeAddingFunds.addn(
                                this.bobSuppliedFunds,
                            ).addn(this.carolSuppliedFunds);
                            expect(quasarCapacityAfterAddingFunds).to.be.bignumber.equal(expectedQuasarCapacity);
                        });

                        describe('When Alice obtains a ticket and claims', () => {
                            before(async () => {
                                await aliceDepositsETH();
                                await submitPlasmaBlock();
                                await submitPlasmaBlock();

                                // Submit abother block for the safe margin
                                const utxoPos = this.depositUtxoPos;
                                const rlpOutputCreationTx = this.depositTx;
                                const outputCreationTxInclusionProof = this.merkleProofForDepositTx;
                                this.quasarCapacityBeforeTicket = new BN(await this.quasar.tokenUsableCapacity(ETH));
                                await this.quasar.obtainTicket(
                                    utxoPos,
                                    rlpOutputCreationTx,
                                    outputCreationTxInclusionProof,
                                    {
                                        from: alice,
                                        value: this.dummyQuasarBondValue,
                                    },
                                );
                                await aliceTransferEth(quasarOwner, DEPOSIT_VALUE);
                                const utxoPosQuasarOwner = this.transferUtxoPos;
                                const rlpTxToQuasarOwner = this.transferTx;
                                const txToQuasarOwnerInclusionProof = this.merkleProofForTransferTx;

                                this.aliceBalanceBeforeClaim = new BN(
                                    await web3.eth.getBalance(alice),
                                );
                                this.reservedAmount = (await this.quasar.ticketData(utxoPos)).reservedAmount;
                                this.poolSupplyBeforeClaim = (await this.quasar.tokenData(ETH)).poolSupply;
                                this.exchangeRateBeforeClaim = (await this.quasar.tokenData(ETH)).exchangeRate;

                                const { receipt } = await this.quasar.claim(
                                    utxoPos,
                                    utxoPosQuasarOwner,
                                    rlpTxToQuasarOwner,
                                    txToQuasarOwnerInclusionProof,
                                    {
                                        from: alice,
                                    },
                                );
                                this.claimReceipt = receipt;
                            });

                            describe('And then Bob Withdraws and Dave supplies', () => {
                                before(async () => {
                                    this.quasarPoolSupplyBeforeWithdraw = (await this.quasar.tokenData(ETH)).poolSupply;
                                    this.bobQTokenBalance = new BN(await this.qEth.balanceOf(bob));
                                    this.bobBalanceBeforeWithdraw = new BN(await web3.eth.getBalance(bob));

                                    const { exchangeRate } = await this.quasar.tokenData(ETH);
                                    this.bobWithdrawAmount = await calculateWithdrawAmount(
                                        this.bobQTokenBalance,
                                        exchangeRate,
                                    );

                                    this.bobWithdrawTx = await this.quasar.withdrawFunds(
                                        ETH,
                                        this.bobQTokenBalance,
                                        { from: bob },
                                    );
                                    await this.quasar.addEthCapacity({ from: dave, value: this.daveSuppliedFunds });
                                });

                                it('should update Bob\'s qToken Balance', async () => {
                                    const bobQTokenBalanceAfterWithdraw = await this.qEth.balanceOf(bob);

                                    expect(bobQTokenBalanceAfterWithdraw).to.be.bignumber.equal(new BN(0));
                                });

                                it('should update the quasar supply and capacity', async () => {
                                    const quasarCapacityAfterWithdraw = new BN(
                                        await this.quasar.tokenUsableCapacity(ETH),
                                    );
                                    const quasarPoolSupplyAfterWithdraw = (await this.quasar.tokenData(ETH)).poolSupply;
                                    const expectedPoolSupply = quasarCapacityAfterWithdraw.add(
                                        (await this.quasar.tokenData(ETH)).owedAmount,
                                    );

                                    expect(expectedPoolSupply).to.be.bignumber.equal(quasarPoolSupplyAfterWithdraw)
                                        .not.equal(this.quasarPoolSupplyBeforeWithdraw);
                                });

                                describe('And When another ticket is claimed', () => {
                                    before(async () => {
                                        await aliceDepositsETH();
                                        await submitPlasmaBlock();
                                        await submitPlasmaBlock();

                                        // Submit abother block for the safe margin
                                        const utxoPos = this.depositUtxoPos;
                                        const rlpOutputCreationTx = this.depositTx;
                                        const outputCreationTxInclusionProof = this.merkleProofForDepositTx;
                                        this.quasarCapacityBeforeTicket = new BN(
                                            await this.quasar.tokenUsableCapacity(ETH),
                                        );
                                        await this.quasar.obtainTicket(
                                            utxoPos,
                                            rlpOutputCreationTx,
                                            outputCreationTxInclusionProof,
                                            {
                                                from: alice,
                                                value: this.dummyQuasarBondValue,
                                            },
                                        );
                                        await aliceTransferEth(quasarOwner, DEPOSIT_VALUE);
                                        const utxoPosQuasarOwner = this.transferUtxoPos;
                                        const rlpTxToQuasarOwner = this.transferTx;
                                        const txToQuasarOwnerInclusionProof = this.merkleProofForTransferTx;

                                        this.aliceBalanceBeforeClaim = new BN(
                                            await web3.eth.getBalance(alice),
                                        );
                                        this.reservedAmount = (await this.quasar.ticketData(utxoPos)).reservedAmount;
                                        this.poolSupplyBeforeClaim = (await this.quasar.tokenData(ETH)).poolSupply;
                                        this.exchangeRateBeforeClaim = (await this.quasar.tokenData(ETH)).exchangeRate;

                                        const { receipt } = await this.quasar.claim(
                                            utxoPos,
                                            utxoPosQuasarOwner,
                                            rlpTxToQuasarOwner,
                                            txToQuasarOwnerInclusionProof,
                                            {
                                                from: alice,
                                            },
                                        );
                                        this.claimReceipt = receipt;
                                    });

                                    describe('And then the quasar Maintainer repays owed funds', () => {
                                        before(async () => {
                                            this.owedAmountBeforeRepayment = (await this.quasar.tokenData(
                                                ETH,
                                            )).owedAmount;
                                            await this.quasar.repayOwedToken(
                                                ETH,
                                                0,
                                                { from: quasarMaintainer, value: this.owedAmountBeforeRepayment },
                                            );
                                        });

                                        describe('If both Carol and Dave now wish to withdraw funds from the pool', () => {
                                            before(async () => {
                                                this.carolBalanceBeforeWithdraw = new BN(
                                                    await web3.eth.getBalance(carol),
                                                );
                                                this.daveBalanceBeforeWithdraw = new BN(
                                                    await web3.eth.getBalance(dave),
                                                );
                                                const carolQTokenBalance = new BN(await this.qEth.balanceOf(carol));
                                                const daveQTokenBalance = new BN(await this.qEth.balanceOf(dave));

                                                const { exchangeRate } = await this.quasar.tokenData(ETH);
                                                this.carolWithdrawAmount = await calculateWithdrawAmount(
                                                    carolQTokenBalance,
                                                    exchangeRate,
                                                );

                                                this.daveWithdrawAmount = await calculateWithdrawAmount(
                                                    daveQTokenBalance,
                                                    exchangeRate,
                                                );


                                                this.carolWithdrawTx = await this.quasar.withdrawFunds(
                                                    ETH,
                                                    carolQTokenBalance,
                                                    { from: carol },
                                                );

                                                this.daveWithdrawTx = await this.quasar.withdrawFunds(
                                                    ETH,
                                                    daveQTokenBalance,
                                                    { from: dave },
                                                );
                                            });

                                            it('should be able to withdraw all qTokens', async () => {
                                                const carolQTokenBalanceAfterWithdraw = await this.qEth.balanceOf(
                                                    carol,
                                                );
                                                const daveQTokenBalanceAfterWithdraw = await this.qEth.balanceOf(
                                                    dave,
                                                );

                                                expect(carolQTokenBalanceAfterWithdraw).to.be.bignumber.equal(
                                                    new BN(0),
                                                );
                                                expect(daveQTokenBalanceAfterWithdraw).to.be.bignumber.equal(
                                                    new BN(0),
                                                );
                                            });

                                            it('should update the quasar capacity and balance', async () => {
                                                const quasarCapacityAfterWithdraw = new BN(
                                                    await this.quasar.tokenUsableCapacity(ETH),
                                                );
                                                const quasarBalance = new BN(
                                                    await web3.eth.getBalance(this.quasar.address),
                                                );
                                                const { poolSupply } = await this.quasar.tokenData(ETH);

                                                expect(quasarCapacityAfterWithdraw).to.be.bignumber.equal(
                                                    quasarBalance,
                                                ).equal(poolSupply);

                                                // some residue might remain in the pool
                                                // due to rounding down while withdrawing
                                                // expect the residue to be very small
                                                expect(quasarBalance).to.be.bignumber.at.most(
                                                    new BN(10),
                                                ).at.least(new BN(0));
                                            });

                                            it('should distribute returns in accordance with time', async () => {
                                                const bobBalanceAfterWithdraw = new BN(
                                                    await web3.eth.getBalance(bob),
                                                );
                                                const carolBalanceAfterWithdraw = new BN(
                                                    await web3.eth.getBalance(carol),
                                                );
                                                const daveBalanceAfterWithdraw = new BN(
                                                    await web3.eth.getBalance(dave),
                                                );

                                                const bobReturnProfit = bobBalanceAfterWithdraw.add(
                                                    await spentOnGas(this.bobWithdrawTx.receipt),
                                                ).sub(this.bobBalanceBeforeWithdraw).subn(this.bobSuppliedFunds);

                                                const expectedBobReturnProfit = this.bobWithdrawAmount.subn(
                                                    this.bobSuppliedFunds,
                                                );
                                                expect(bobReturnProfit).to.be.bignumber.equal(expectedBobReturnProfit);

                                                const carolReturnProfit = carolBalanceAfterWithdraw.add(
                                                    await spentOnGas(this.carolWithdrawTx.receipt),
                                                ).sub(this.carolBalanceBeforeWithdraw).subn(this.carolSuppliedFunds);

                                                const expectedCarolReturnProfit = this.carolWithdrawAmount.subn(
                                                    this.carolSuppliedFunds,
                                                );
                                                expect(carolReturnProfit).to.be.bignumber.equal(
                                                    expectedCarolReturnProfit,
                                                );

                                                const daveReturnProfit = daveBalanceAfterWithdraw.add(
                                                    await spentOnGas(this.daveWithdrawTx.receipt),
                                                ).sub(this.daveBalanceBeforeWithdraw).subn(this.daveSuppliedFunds);

                                                const expectedDaveReturnProfit = this.daveWithdrawAmount.subn(
                                                    this.daveSuppliedFunds,
                                                );
                                                expect(daveReturnProfit).to.be.bignumber.equal(
                                                    expectedDaveReturnProfit,
                                                );

                                                expect(carolReturnProfit).be.bignumber.above(bobReturnProfit);
                                                expect(carolReturnProfit).be.bignumber.above(daveReturnProfit);
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });

                /**
                 * Scenario -
                 * Bob and Carol supply erc20 to the pool
                 * After one round of (IFE) claim, Bob withdraws some qTokens
                 * After second round of claim, Bob and Carol withdraw all tokens
                */
                describe('Scenario: Three suppliers, different amount and entry point', () => {
                    describe('When Bob and Carol supply ERC20 to the pool', () => {
                        before(async () => {
                            await this.framework.addExitQueue(config.registerKeys.vaultId.erc20, this.erc20.address);

                            this.quasarCapacityBeforeAddingFunds = new BN(
                                await this.quasar.tokenUsableCapacity(this.erc20.address),
                            );
                            this.bobSuppliedERC20Funds = 1000000;
                            this.carolSuppliedERC20Funds = 2000000;

                            await this.erc20.transfer(bob, this.bobSuppliedERC20Funds, { from: richDad });
                            await this.erc20.approve(this.quasar.address, this.bobSuppliedERC20Funds, { from: bob });
                            await this.quasar.addTokenCapacity(
                                this.erc20.address, this.bobSuppliedERC20Funds, { from: bob },
                            );

                            await this.erc20.transfer(carol, this.carolSuppliedERC20Funds, { from: richDad });
                            await this.erc20.approve(
                                this.quasar.address,
                                this.carolSuppliedERC20Funds,
                                { from: carol },
                            );
                            await this.quasar.addTokenCapacity(
                                this.erc20.address, this.carolSuppliedERC20Funds, { from: carol },
                            );
                        });

                        it('should increase the capacity of the Quasar', async () => {
                            this.quasarCapacityAfterAddingFunds = new BN(
                                await this.quasar.tokenUsableCapacity(this.erc20.address),
                            );
                            const quasarExpectedCapacity = this.quasarCapacityBeforeAddingFunds.addn(
                                this.bobSuppliedERC20Funds,
                            ).addn(this.carolSuppliedERC20Funds);

                            expect(this.quasarCapacityAfterAddingFunds).to.be.bignumber.equal(
                                quasarExpectedCapacity,
                            );

                            const quasarPoolSupply = (await this.quasar.tokenData(this.erc20.address)).poolSupply;
                            const { owedAmount } = await this.quasar.tokenData(this.erc20.address);
                            expect(quasarPoolSupply).to.be.bignumber.equal(
                                this.quasarCapacityAfterAddingFunds.add(owedAmount),
                            );
                        });

                        describe('When Alice obtains a ticket and ife claims', () => {
                            before(async () => {
                                await this.erc20.transfer(alice, DEPOSIT_VALUE, { from: richDad });
                                await this.erc20.approve(this.erc20Vault.address, DEPOSIT_VALUE, { from: alice });
                                await aliceDepositsErc20();
                                await submitPlasmaBlock();
                                await submitPlasmaBlock();

                                const utxoPos = this.depositUtxoPos;
                                const rlpOutputCreationTx = this.depositTx;
                                const outputCreationTxInclusionProof = this.merkleProofForDepositTx;
                                await this.quasar.obtainTicket(
                                    utxoPos,
                                    rlpOutputCreationTx,
                                    outputCreationTxInclusionProof,
                                    {
                                        from: alice,
                                        value: this.dummyQuasarBondValue,
                                    },
                                );

                                await aliceTransferErc20(quasarOwner, DEPOSIT_VALUE);

                                const inputTxs = [this.depositTx];
                                const inputUtxosPos = [this.depositUtxoPos];
                                const inputTxsInclusionProofs = [this.merkleProofForDepositTx];

                                const txHash = hashTx(this.transferTxObject, this.framework.address);
                                const signature = sign(txHash, alicePrivateKey);

                                const args = {
                                    inFlightTx: this.transferTx,
                                    inputTxs,
                                    inputUtxosPos,
                                    inputTxsInclusionProofs,
                                    inFlightTxWitnesses: [signature],
                                };

                                await this.exitGame.startInFlightExit(
                                    args,
                                    { from: alice, value: this.startIFEBondSize },
                                );

                                const rlpTxToQuasarOwner = this.transferTx;

                                await this.quasar.ifeClaim(
                                    utxoPos,
                                    rlpTxToQuasarOwner,
                                    {
                                        from: alice,
                                    },
                                );

                                this.exitingOutputIndex = 0;
                                this.reservedAmount = (await this.quasar.ticketData(utxoPos)).reservedAmount;
                                const piggybackArgs = {
                                    inFlightTx: this.transferTx,
                                    outputIndex: this.exitingOutputIndex,
                                };

                                this.piggybackTx = await this.exitGame.piggybackInFlightExitOnOutput(
                                    piggybackArgs,
                                    { from: quasarOwner, value: this.piggybackBondSize },
                                );

                                await time.increase(time.duration.seconds(this.ifeWaitingPeriod).add(
                                    time.duration.seconds(1),
                                ));

                                await this.quasar.processIfeClaim(utxoPos);
                            });

                            it('should update the quasar capacity', async () => {
                                const quasarCapacityAfterClaim = new BN(
                                    await this.quasar.tokenUsableCapacity(this.erc20.address),
                                );
                                const expectedQuasarCapacity = this.quasarCapacityAfterAddingFunds.sub(
                                    this.reservedAmount,
                                );

                                expect(quasarCapacityAfterClaim).to.be.bignumber.equal(expectedQuasarCapacity);
                            });

                            describe('And then Bob withdraws half of the qtokens', () => {
                                before(async () => {
                                    this.bobBalanceBeforeWithdraw = await this.erc20.balanceOf(bob);
                                    this.bobQTokenBalance = await this.qErc20.balanceOf(bob);
                                    this.withdrawTokens = new BN((this.bobQTokenBalance / 2).toFixed());

                                    const { exchangeRate } = await this.quasar.tokenData(this.erc20.address);
                                    this.bobWithdrawAmountFirstRound = await calculateWithdrawAmount(
                                        this.withdrawTokens,
                                        exchangeRate,
                                    );

                                    this.bobWithdrawTx = await this.quasar.withdrawFunds(
                                        this.erc20.address,
                                        this.withdrawTokens,
                                        { from: bob },
                                    );
                                });

                                it('should update Bob\'s qToken Balance', async () => {
                                    const bobQTokenBalanceAfterWithdraw = await this.qErc20.balanceOf(bob);

                                    expect(bobQTokenBalanceAfterWithdraw).to.be.bignumber.equal(
                                        this.bobQTokenBalance.sub(this.withdrawTokens),
                                    );
                                });

                                describe('And When another ticket is claimed', () => {
                                    before(async () => {
                                        await this.erc20.transfer(alice, DEPOSIT_VALUE, { from: richDad });
                                        await this.erc20.approve(
                                            this.erc20Vault.address,
                                            DEPOSIT_VALUE,
                                            { from: alice },
                                        );
                                        await aliceDepositsErc20();
                                        await submitPlasmaBlock();
                                        await submitPlasmaBlock();

                                        // Submit abother block for the safe margin
                                        const utxoPos = this.depositUtxoPos;
                                        const rlpOutputCreationTx = this.depositTx;
                                        const outputCreationTxInclusionProof = this.merkleProofForDepositTx;

                                        await this.quasar.obtainTicket(
                                            utxoPos,
                                            rlpOutputCreationTx,
                                            outputCreationTxInclusionProof,
                                            {
                                                from: alice,
                                                value: this.dummyQuasarBondValue,
                                            },
                                        );
                                        await aliceTransferErc20(quasarOwner, DEPOSIT_VALUE);
                                        const utxoPosQuasarOwner = this.transferUtxoPos;
                                        const rlpTxToQuasarOwner = this.transferTx;
                                        const txToQuasarOwnerInclusionProof = this.merkleProofForTransferTx;

                                        this.aliceBalanceBeforeClaim = new BN(
                                            await web3.eth.getBalance(alice),
                                        );
                                        this.reservedAmount = (await this.quasar.ticketData(utxoPos)).reservedAmount;

                                        const { receipt } = await this.quasar.claim(
                                            utxoPos,
                                            utxoPosQuasarOwner,
                                            rlpTxToQuasarOwner,
                                            txToQuasarOwnerInclusionProof,
                                            {
                                                from: alice,
                                            },
                                        );
                                        this.claimReceipt = receipt;
                                    });

                                    describe('And then the quasar Maintainer repays owed funds', () => {
                                        before(async () => {
                                            this.owedAmountBeforeRepayment = (await this.quasar.tokenData(
                                                this.erc20.address,
                                            )).owedAmount;
                                            await this.erc20.transfer(
                                                quasarMaintainer,
                                                this.owedAmountBeforeRepayment,
                                                { from: richDad },
                                            );
                                            await this.erc20.approve(
                                                this.quasar.address,
                                                this.owedAmountBeforeRepayment,
                                                { from: quasarMaintainer },
                                            );
                                            await this.quasar.repayOwedToken(
                                                this.erc20.address,
                                                this.owedAmountBeforeRepayment,
                                                { from: quasarMaintainer },
                                            );
                                        });

                                        describe('If both Bob and Carol now wish to withdraw all funds from the pool', () => {
                                            before(async () => {
                                                this.carolBalanceBeforeWithdraw = await this.erc20.balanceOf(carol);
                                                this.qMaintainerBalanceBeforeWithdraw = await this.erc20.balanceOf(
                                                    quasarMaintainer,
                                                );

                                                const bobQTokenBalance = await this.qErc20.balanceOf(bob);

                                                const { exchangeRate } = await this.quasar.tokenData(
                                                    this.erc20.address,
                                                );
                                                this.bobWithdrawAmountSecondRound = await calculateWithdrawAmount(
                                                    bobQTokenBalance,
                                                    exchangeRate,
                                                );

                                                this.bobWithdrawTx = await this.quasar.withdrawFunds(
                                                    this.erc20.address,
                                                    bobQTokenBalance,
                                                    { from: bob },
                                                );
                                                const carolQTokenBalance = await this.qErc20.balanceOf(carol);

                                                this.carolWithdrawAmount = await calculateWithdrawAmount(
                                                    carolQTokenBalance,
                                                    exchangeRate,
                                                );

                                                this.carolWithdrawTx = await this.quasar.withdrawFunds(
                                                    this.erc20.address,
                                                    carolQTokenBalance,
                                                    { from: carol },
                                                );

                                                const quasarMaintainerQTokenBalance = await this.qErc20.balanceOf(
                                                    quasarMaintainer,
                                                );

                                                this.qMaintainerWithdrawAmount = await calculateWithdrawAmount(
                                                    quasarMaintainerQTokenBalance,
                                                    exchangeRate,
                                                );

                                                this.qMaintainerWithdrawTx = await this.quasar.withdrawFunds(
                                                    this.erc20.address,
                                                    quasarMaintainerQTokenBalance,
                                                    { from: quasarMaintainer },
                                                );
                                            });

                                            it('should be able to withdraw all qTokens', async () => {
                                                const bobQTokenBalAfterWithdraw = await this.qErc20.balanceOf(bob);
                                                const carolQTokenBalAfterWithdraw = await this.qErc20.balanceOf(carol);
                                                const qMaintainerQTokenBalAfterWithdraw = await this.qErc20.balanceOf(
                                                    quasarMaintainer,
                                                );

                                                expect(bobQTokenBalAfterWithdraw).to.be.bignumber.equal(
                                                    new BN(0),
                                                );
                                                expect(carolQTokenBalAfterWithdraw).to.be.bignumber.equal(
                                                    new BN(0),
                                                );
                                                expect(qMaintainerQTokenBalAfterWithdraw).to.be.bignumber.equal(
                                                    new BN(0),
                                                );
                                            });

                                            it('should update the quasar capacity and balance', async () => {
                                                const quasarCapacityAfterWithdraw = new BN(
                                                    await this.quasar.tokenUsableCapacity(this.erc20.address),
                                                );
                                                const { poolSupply } = await this.quasar.tokenData(this.erc20.address);

                                                expect(quasarCapacityAfterWithdraw).to.be.bignumber.equal(poolSupply);
                                                // some residue might remain in the pool
                                                // due to rounding down while withdrawing
                                                // expect the residue to be very small
                                                expect(quasarCapacityAfterWithdraw).to.be.bignumber.at.most(
                                                    new BN(10),
                                                ).at.least(new BN(0));
                                            });

                                            it('should distribute returns in accordance with the supplied amount', async () => {
                                                const bobBalanceAfterWithdraw = await this.erc20.balanceOf(bob);
                                                const carolBalanceAfterWithdraw = await this.erc20.balanceOf(carol);
                                                const qMaintainerBalanceAfterWithdraw = await this.erc20.balanceOf(
                                                    quasarMaintainer,
                                                );

                                                const bobReturnProfit = bobBalanceAfterWithdraw.sub(
                                                    this.bobBalanceBeforeWithdraw,
                                                ).subn(this.bobSuppliedERC20Funds);

                                                const expectedBobReturnProfit = this.bobWithdrawAmountFirstRound.add(
                                                    this.bobWithdrawAmountSecondRound,
                                                ).subn(this.bobSuppliedERC20Funds);
                                                expect(bobReturnProfit).to.be.bignumber.equal(expectedBobReturnProfit);

                                                const carolReturnProfit = carolBalanceAfterWithdraw.sub(
                                                    this.carolBalanceBeforeWithdraw,
                                                ).subn(this.carolSuppliedERC20Funds);

                                                const expectedCarolReturnProfit = this.carolWithdrawAmount.subn(
                                                    this.carolSuppliedERC20Funds,
                                                );
                                                expect(carolReturnProfit).to.be.bignumber.equal(
                                                    expectedCarolReturnProfit,
                                                );

                                                const qMaintainerReturnProfit = qMaintainerBalanceAfterWithdraw.sub(
                                                    this.qMaintainerBalanceBeforeWithdraw,
                                                ).subn(QUASAR_LIQUID_FUNDS);

                                                const expectedQMaintainerReturn = this.qMaintainerWithdrawAmount.subn(
                                                    QUASAR_LIQUID_FUNDS,
                                                );
                                                expect(qMaintainerReturnProfit).to.be.bignumber.equal(
                                                    expectedQMaintainerReturn,
                                                );

                                                expect(qMaintainerReturnProfit).to.be.bignumber.above(
                                                    carolReturnProfit,
                                                );
                                                expect(carolReturnProfit).to.be.bignumber.above(
                                                    bobReturnProfit,
                                                );
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    },
);
