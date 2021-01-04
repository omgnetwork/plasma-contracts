const PaymentExitGame = artifacts.require('PaymentExitGame');
const PlasmaFramework = artifacts.require('PlasmaFramework');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const Quasar = artifacts.require('../Quasar');
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
    ([_deployer, _maintainer, authority, bob, richDad, quasarMaintainer, quasarOwner]) => {
        const ETH = constants.ZERO_ADDRESS;
        const OUTPUT_TYPE_PAYMENT = config.registerKeys.outputTypes.payment;
        const INITIAL_ERC20_SUPPLY = 10000000000;
        const DEPOSIT_VALUE = 1000000;
        const QUASAR_LIQUID_FUNDS = 3000000;
        const MERKLE_TREE_DEPTH = 16;

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
        };

        const setupQuasar = async () => {
            this.waitingPeriod = 14400;
            this.dummyQuasarBondValue = 500;
            const safePlasmaBlockNum = 0;

            this.quasar = await Quasar.new(
                this.framework.address,
                this.spendingConditionRegistry.address,
                quasarOwner,
                safePlasmaBlockNum,
                this.waitingPeriod,
                this.dummyQuasarBondValue,
                { from: quasarMaintainer },
            );
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
                                    'UTXO is from a block over the safe limit',
                                );
                            });
                        });

                        // add check for onlyMaintainer functions
                        describe('If the Quasar maintainer updates the safeblocknum to allow the output', () => {
                            before(async () => {
                                this.preSafeBlocknum = await this.quasar.safePlasmaBlockNum();
                                this.dummySafeBlockLimit = (await this.framework.childBlockInterval()).toNumber() * 3;
                                await this.quasar.updateSafeBlockLimit(
                                    this.dummySafeBlockLimit,
                                    { from: quasarMaintainer },
                                );
                            });

                            it('should update the safeblocknum to the new value', async () => {
                                const currentSafeBlocknum = await this.quasar.safePlasmaBlockNum();
                                expect(currentSafeBlocknum).to.be.bignumber.equal(new BN(this.dummySafeBlockLimit));
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
                                        'Provided Tx doesn\'t exist',
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
                                        'Bond Value incorrect',
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
                                    expect(ticketData.reservedAmount).to.be.bignumber.equal(new BN(DEPOSIT_VALUE));
                                    expect(ticketData.token).to.be.equal(ETH);
                                    expect(ticketData.bondValue).to.be.bignumber.equal(
                                        new BN(this.dummyQuasarBondValue),
                                    );
                                    expect(ticketData.isClaimed).to.be.false;
                                });

                                it('should reduce the Quasar capacity for ETH', async () => {
                                    const updatedQuasarCapacity = new BN(await this.quasar.tokenUsableCapacity(ETH));
                                    const expectedQuasarCapacity = this.quasarCapacityBeforeObtainingTicket.subn(
                                        DEPOSIT_VALUE,
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
                                        'The ticket is still valid or needs to be flushed',
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
                                            'Wrong Amount Sent to Quasar Owner',
                                        );
                                    });
                                });

                                // TO_ADD[erc20]: a test for blocking claim if the output formed is a different token

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
                                                'Not called by the ticket owner',
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
                                                'Provided Tx doesn\'t exist',
                                            );
                                        });
                                    });

                                    describe('When Alice tries to start claim with proper parameters', () => {
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

                                        it('should allow Alice to start a claim', async () => {
                                            const ticketData = await this.quasar.ticketData(this.depositUtxoPos);
                                            expect(ticketData.isClaimed).to.be.true;
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
                                                'Already Claimed',
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
                                                'The UTXO has already been claimed',
                                            );
                                        });

                                        describe('And Then someone processes the claim after the waiting period', () => {
                                            it('should not allow to process before the waiting period', async () => {
                                                const utxoPos = this.depositUtxoPos;

                                                await expectRevert(
                                                    this.quasar.processClaim(
                                                        utxoPos,
                                                    ),
                                                    'Claim not finalized',
                                                );
                                            });

                                            describe('When the waiting period passes', () => {
                                                before(async () => {
                                                    await time.increase(time.duration.seconds(this.waitingPeriod).add(
                                                        time.duration.seconds(1),
                                                    ));
                                                });
                                                it('should allow to process claim and return the amount plus bond to Alice', async () => {
                                                    const utxoPos = this.depositUtxoPos;
                                                    const aliceBalanceBeforeProcessClaim = new BN(
                                                        await web3.eth.getBalance(alice),
                                                    );
                                                    await this.quasar.processClaim(utxoPos);
                                                    const aliceBalanceAfterProcessClaim = new BN(
                                                        await web3.eth.getBalance(alice),
                                                    );
                                                    const expectedAliceBalance = aliceBalanceBeforeProcessClaim.addn(
                                                        DEPOSIT_VALUE,
                                                    ).addn(this.dummyQuasarBondValue);

                                                    expect(aliceBalanceAfterProcessClaim).to.be.bignumber.equal(
                                                        expectedAliceBalance,
                                                    );
                                                });

                                                it('should not allow to process claim again', async () => {
                                                    const utxoPos = this.depositUtxoPos;
                                                    await expectRevert(
                                                        this.quasar.processClaim(utxoPos),
                                                        'Already claimed or the claim was challenged',
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

                describe('Given Alice deposited ETH to Vault and obtains a ticket for the output', () => {
                    before(async () => {
                        await aliceDepositsETH();
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
                                    await time.increase(time.duration.seconds(this.waitingPeriod).sub(
                                        time.duration.seconds(1),
                                    ));
                                    const utxoPos = this.depositUtxoPos;
                                    const rlpChallengeTx = this.bobTransferTx;
                                    const challengeTxInputIndex = 0;
                                    const txHash = hashTx(this.bobTransferTxObject, this.framework.address);
                                    const signature = sign(txHash, alicePrivateKey);

                                    this.quasarMaintainerBalanceBeforeChallenge = new BN(
                                        await web3.eth.getBalance(quasarMaintainer),
                                    );
                                    this.quasarCapacityBeforeChallenge = new BN(
                                        await this.quasar.tokenUsableCapacity(ETH),
                                    );
                                    const { receipt } = await this.quasar.challengeClaim(
                                        utxoPos,
                                        rlpChallengeTx,
                                        challengeTxInputIndex,
                                        signature,
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
                                        DEPOSIT_VALUE,
                                    );

                                    expect(quasarExpectedCapacity).to.be.bignumber.equal(quasarCapacityAfterChallenge);
                                });

                                it('should not allow processing Claim', async () => {
                                    // +2 seconds from last increase
                                    await time.increase(time.duration.seconds(2));
                                    const utxoPos = this.depositUtxoPos;
                                    await expectRevert(
                                        this.quasar.processClaim(utxoPos),
                                        'Already claimed or the claim was challenged',
                                    );
                                });
                            });
                        });
                    });
                });

                describe('Given Alice deposited ETH and transferred somee to Bob', () => {
                    before(async () => {
                        await aliceDepositsETH();
                        await this.quasar.updateSafeBlockLimit(
                            this.dummySafeBlockLimit * 2,
                            { from: quasarMaintainer },
                        );
                        await aliceTransferEth(bob, DEPOSIT_VALUE / 2);
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
                                    'Ticket is not valid',
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
                                        DEPOSIT_VALUE / 2,
                                    );

                                    expect(quasarCapacityAfterFlush).to.be.bignumber.equal(quasarExpectedCapacity);
                                });

                                it('should not allow to flush same ticket again', async () => {
                                    await expectRevert(
                                        this.quasar.flushExpiredTicket(this.bobUtxoPos),
                                        'Ticket still valid or doesn\'t exist',
                                    );
                                });

                                describe('When the Quasar Maintainer tries to withdraw unreserved funds plus the bond reserve', () => {
                                    it('should not allow to withdraw if withdrawal amount is more than claimable funds', async () => {
                                        const quasarCapacity = new BN(await this.quasar.tokenUsableCapacity(ETH));
                                        const withdrawableFunds = quasarCapacity.addn(
                                            this.dummyQuasarBondValue,
                                        ).addn(1);
                                        await expectRevert(
                                            this.quasar.withdrawLiquidEthFunds(
                                                withdrawableFunds,
                                                { from: quasarMaintainer },
                                            ),
                                            'Amount should be lower than claimable funds',
                                        );
                                    });

                                    it('should allow to withdraw all claimable funds', async () => {
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
                                        const withdrawableFunds = quasarCapacity.addn(this.dummyQuasarBondValue);
                                        const { receipt } = await this.quasar.withdrawLiquidEthFunds(
                                            withdrawableFunds,
                                            { from: quasarMaintainer },
                                        );

                                        const quasarMaintainerBalanceAfterWithdraw = new BN(
                                            await web3.eth.getBalance(quasarMaintainer),
                                        );
                                        const expectedQuasarMaintainerBalance = quasarMaintainerBalanceBeforeWithdraw
                                            .add(withdrawableFunds)
                                            .sub(await spentOnGas(receipt));

                                        expect(quasarMaintainerBalanceAfterWithdraw).to.be.bignumber.equal(
                                            expectedQuasarMaintainerBalance,
                                        );
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
