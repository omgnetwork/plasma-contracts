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
            this.waitingPeriod = 14400;
            this.dummyQuasarBondValue = 500;

            this.quasar = await Quasar.new(
                this.framework.address,
                this.spendingConditionRegistry.address,
                quasarOwner,
                INITIAL_SAFE_BLOCK_MARGIN,
                this.waitingPeriod,
                this.dummyQuasarBondValue,
                { from: quasarMaintainer },
            );
            this.ifeWaitingPeriod = await this.quasar.IFE_CLAIM_WAITING_PERIOD();
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
                                    'The UTXO is from a block later than the safe limit',
                                );
                            });
                        });

                        describe('If the Quasar maintainer updates the safeblocknum to allow the output', () => {
                            before(async () => {
                                this.preSafeBlockMargin = await this.quasar.safeBlockMargin();
                                this.dummySafeBlockMargin = 1;
                                await this.quasar.setSafeBlockMargin(
                                    this.dummySafeBlockMargin,
                                    { from: quasarMaintainer },
                                );

                                await submitPlasmaBlock();
                            });

                            it('should update the safeblocknum to the new value', async () => {
                                const safeBlockMargin = await this.quasar.safeBlockMargin();
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
                                        'This UTXO already has a ticket',
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
                                            'Wrong amount sent to quasar owner',
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
                                                    'The claim is not finalized yet',
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
                                                        'The claim has already been claimed or challenged',
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
                                    await time.increase(time.duration.seconds(this.waitingPeriod).sub(
                                        time.duration.seconds(1),
                                    ));
                                    const utxoPos = this.depositUtxoPos;
                                    const rlpChallengeTx = this.bobTransferTx;
                                    const challengeTxInputIndex = 0;
                                    const txHash = hashTx(this.bobTransferTxObject, this.framework.address);
                                    const signature = sign(txHash, alicePrivateKey);
                                    const sharedOutputInputIndex = 0;
                                    const sharedOutputCreationTx = '0x';

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
                                        sharedOutputInputIndex,
                                        sharedOutputCreationTx,
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
                                        'The claim has already been claimed or challenged',
                                    );
                                });
                            });
                        });
                    });
                });

                describe('Given Alice deposited ETH and transferred somee to Bob', () => {
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

                                describe('When the Quasar Maintainer tries to withdraw unreserved funds plus the unclaimed bonds ', () => {
                                    it('should not allow to withdraw if withdrawal amount is more than claimable funds', async () => {
                                        const quasarCapacity = new BN(await this.quasar.tokenUsableCapacity(ETH));
                                        const withdrawableFunds = quasarCapacity.addn(1);
                                        await expectRevert(
                                            this.quasar.withdrawEth(
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

                                        const txUnclaimedBonds = await this.quasar.withdrawUnclaimedBonds(
                                            { from: quasarMaintainer },
                                        );

                                        const txEthWithdrawal = await this.quasar.withdrawEth(
                                            quasarCapacity,
                                            { from: quasarMaintainer },
                                        );

                                        const quasarMaintainerBalanceAfterWithdraw = new BN(
                                            await web3.eth.getBalance(quasarMaintainer),
                                        );

                                        const expectedQuasarMaintainerBalance = quasarMaintainerBalanceBeforeWithdraw
                                            .add(quasarCapacity)
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
                                        'IFE has not been started',
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
                                        'The UTXO has already been claimed',
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
                                                this.quasar.processClaim(
                                                    utxoPos,
                                                ),
                                                'The claim is not finalized yet',
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
                                                    'The claim has already been claimed or challenged',
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
                                    const sharedOutputInputIndex = 0;
                                    const sharedOutputCreationTx = '0x';

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
                                        sharedOutputInputIndex,
                                        sharedOutputCreationTx,
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
                                        'The claim has already been claimed or challenged',
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
                                        const sharedOutputInputIndex = 1;
                                        const sharedOutputCreationTx = this.outputBDepositTx;

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
                                            this.signatureTx2,
                                            sharedOutputInputIndex,
                                            sharedOutputCreationTx,
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
                                            DEPOSIT_VALUE,
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
                                            this.quasar.processClaim(utxoPos),
                                            'The claim has already been claimed or challenged',
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
                                    this.preSafeBlockMargin = await this.quasar.safeBlockMargin();
                                    this.dummySafeBlockMargin = 1;
                                    await this.quasar.setSafeBlockMargin(
                                        this.dummySafeBlockMargin,
                                        { from: quasarMaintainer },
                                    );

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
                                        expect(ticketData.reservedAmount).to.be.bignumber.equal(new BN(DEPOSIT_VALUE));
                                        expect(ticketData.token).to.be.equal(this.erc20.address);
                                        expect(ticketData.bondValue).to.be.bignumber.equal(
                                            new BN(this.dummyQuasarBondValue),
                                        );
                                        expect(ticketData.isClaimed).to.be.false;
                                    });

                                    it('should reduce the Quasar capacity for Erc20', async () => {
                                        const updatedQuasarCapacity = new BN(
                                            await this.quasar.tokenUsableCapacity(this.erc20.address),
                                        );
                                        const expectedQuasarCapacity = this.quasarCapacityBeforeObtainingTicket.subn(
                                            DEPOSIT_VALUE,
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
                                                'Wrong token sent to quasar owner',
                                            );
                                        });
                                    });

                                    describe('If Alice spends the output correctly in a tx to the quasar owner', () => {
                                        before(async () => {
                                            await aliceTransferErc20(quasarOwner, DEPOSIT_VALUE);
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

                                            describe('And Then someone processes the claim after the waiting period', () => {
                                                describe('When the waiting period passes', () => {
                                                    before(async () => {
                                                        await time.increase(time.duration.seconds(
                                                            this.waitingPeriod,
                                                        ).add(
                                                            time.duration.seconds(1),
                                                        ));
                                                    });
                                                    it('should allow to process claim and return the amount plus bond to Alice', async () => {
                                                        const utxoPos = this.depositUtxoPos;
                                                        const ethBalanceBeforeProcessClaim = new BN(
                                                            await web3.eth.getBalance(alice),
                                                        );
                                                        const erc20BalanceBeforeProcessClaim = new BN(
                                                            await this.erc20.balanceOf(alice),
                                                        );
                                                        await this.quasar.processClaim(utxoPos);
                                                        const ethBalanceAfterProcessClaim = new BN(
                                                            await web3.eth.getBalance(alice),
                                                        );
                                                        const erc20BalanceAfterProcessClaim = new BN(
                                                            await this.erc20.balanceOf(alice),
                                                        );
                                                        const expectedEthBalance = ethBalanceBeforeProcessClaim
                                                            .addn(this.dummyQuasarBondValue);
                                                        const expectedErc20Balance = erc20BalanceBeforeProcessClaim
                                                            .addn(DEPOSIT_VALUE);

                                                        expect(ethBalanceAfterProcessClaim).to.be.bignumber.equal(
                                                            expectedEthBalance,
                                                        );
                                                        expect(erc20BalanceAfterProcessClaim).to.be.bignumber.equal(
                                                            expectedErc20Balance,
                                                        );
                                                    });

                                                    it('should not allow to process claim again', async () => {
                                                        const utxoPos = this.depositUtxoPos;
                                                        await expectRevert(
                                                            this.quasar.processClaim(utxoPos),
                                                            'The claim has already been claimed or challenged',
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
            });
        });
    },
);
