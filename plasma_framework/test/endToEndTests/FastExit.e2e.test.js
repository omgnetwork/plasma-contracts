const PaymentExitGame = artifacts.require('PaymentExitGame');
const PlasmaFramework = artifacts.require('PlasmaFramework');
const Liquidity = artifacts.require('../Liquidity');
const EthVault = artifacts.require('EthVault');
const ExitBounty = artifacts.require('ExitBountyWrapper');
const Erc20Vault = artifacts.require('Erc20Vault');
const ERC20Mintable = artifacts.require('ERC20Mintable');

const {
    BN, constants, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { MerkleTree } = require('../helpers/merkle.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../helpers/transaction.js');
const { computeNormalOutputId, spentOnGas } = require('../helpers/utils.js');
const { buildUtxoPos } = require('../helpers/positions.js');
const Testlang = require('../helpers/testlang.js');
const config = require('../../config.js');

contract(
    'LiquidityContract - Fast Exits - End to End Tests',
    ([_deployer, maintainer, authority, bob, richDad]) => {
        const ETH = constants.ZERO_ADDRESS;
        const OUTPUT_TYPE_PAYMENT = config.registerKeys.outputTypes.payment;
        const INITIAL_ERC20_SUPPLY = 10000000000;
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
            web3.eth.sendTransaction({ to: alice, from: richDad, value: web3.utils.toWei('2', 'ether') });
        };

        const deployStableContracts = async () => {
            this.exitBountyHelper = await ExitBounty.new();
            this.erc20 = await ERC20Mintable.new();
            await this.erc20.mint(richDad, INITIAL_ERC20_SUPPLY);
        };

        before(async () => {
            await Promise.all([setupAccount(), deployStableContracts()]);
        });

        const setupContracts = async () => {
            this.framework = await PlasmaFramework.deployed();

            this.ethVault = await EthVault.at(await this.framework.vaults(config.registerKeys.vaultId.eth));
            this.erc20Vault = await Erc20Vault.at(await this.framework.vaults(config.registerKeys.vaultId.erc20));

            this.exitGame = await PaymentExitGame.at(
                await this.framework.exitGames(config.registerKeys.txTypes.payment),
            );

            this.startStandardExitBondSize = await this.exitGame.startStandardExitBondSize();

            this.dummyGasPrice = 1000000;

            this.processExitBountySize = await this.exitBountyHelper.processStandardExitBountySize({
                gasPrice: this.dummyGasPrice,
            });

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

        const bobDepositsETH = async () => {
            const depositBlockNum = (await this.framework.nextDepositBlock()).toNumber();
            this.bobDepositUtxoPos = buildUtxoPos(depositBlockNum, 0, 0);
            this.bobDepositTx = Testlang.deposit(OUTPUT_TYPE_PAYMENT, DEPOSIT_VALUE, bob);
            this.bobMerkleTreeForDepositTx = new MerkleTree([this.bobDepositTx], MERKLE_TREE_DEPTH);
            this.bobMerkleProofForDepositTx = this.bobMerkleTreeForDepositTx.getInclusionProof(this.bobDepositTx);

            return this.ethVault.deposit(this.bobDepositTx, { from: bob, value: DEPOSIT_VALUE });
        };

        const bobTransferSomeEthToLC = async () => {
            const tranferTxBlockNum = (await this.framework.nextChildBlock()).toNumber();
            this.bobTransferUtxoPos = buildUtxoPos(tranferTxBlockNum, 0, 0);

            const outputLC = new PaymentTransactionOutput(
                OUTPUT_TYPE_PAYMENT,
                TRANSFER_AMOUNT,
                this.liquidity.address,
                ETH,
            );
            const outputBob = new PaymentTransactionOutput(
                OUTPUT_TYPE_PAYMENT,
                DEPOSIT_VALUE - TRANSFER_AMOUNT,
                bob,
                ETH,
            );
            this.bobTransferTxObject = new PaymentTransaction(1, [this.bobDepositUtxoPos], [outputLC, outputBob]);
            this.bobTransferTx = web3.utils.bytesToHex(this.bobTransferTxObject.rlpEncoded());
            this.bobMerkleTreeForTransferTx = new MerkleTree([this.bobTransferTx]);
            this.bobMerkleProofForTransferTx = this.bobMerkleTreeForTransferTx.getInclusionProof(this.bobTransferTx);

            await this.framework.submitBlock(this.bobMerkleTreeForTransferTx.root, { from: authority });
        };

        const aliceDepositsErc20 = async () => {
            const depositBlockNum = (await this.framework.nextDepositBlock()).toNumber();
            this.depositUtxoPos = buildUtxoPos(depositBlockNum, 0, 0);
            this.depositTx = Testlang.deposit(OUTPUT_TYPE_PAYMENT, DEPOSIT_VALUE, alice, this.erc20.address);
            this.merkleTreeForDepositTx = new MerkleTree([this.depositTx], MERKLE_TREE_DEPTH);
            this.merkleProofForDepositTx = this.merkleTreeForDepositTx.getInclusionProof(this.depositTx);

            return this.erc20Vault.deposit(this.depositTx, { from: alice });
        };

        const aliceTransferSomeErcToLC = async () => {
            const tranferTxBlockNum = (await this.framework.nextChildBlock()).toNumber();
            this.transferUtxoPos = buildUtxoPos(tranferTxBlockNum, 0, 0);

            const outputLC = new PaymentTransactionOutput(
                OUTPUT_TYPE_PAYMENT,
                TRANSFER_AMOUNT,
                this.liquidity.address,
                this.erc20.address,
            );
            const outputAlice = new PaymentTransactionOutput(
                OUTPUT_TYPE_PAYMENT,
                DEPOSIT_VALUE - TRANSFER_AMOUNT,
                alice,
                this.erc20.address,
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
                    await aliceDepositsETH();
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
                                {
                                    from: bob,
                                    value: this.startStandardExitBondSize.add(this.processExitBountySize),
                                    gasPrice: this.dummyGasPrice,
                                },
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
                                {
                                    from: alice,
                                    value: this.startStandardExitBondSize.add(this.processExitBountySize),
                                    gasPrice: this.dummyGasPrice,
                                },
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
                            {
                                from: alice,
                                value: this.startStandardExitBondSize.add(this.processExitBountySize),
                                gasPrice: this.dummyGasPrice,
                            },
                        );
                    });

                    it('should start the exit successully', async () => {
                        this.exitId = await this.exitGame.getStandardExitId(
                            false,
                            this.transferTx,
                            this.transferUtxoPos,
                        );
                        const exitIds = [this.exitId];
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
                                {
                                    from: alice,
                                    value: this.startStandardExitBondSize.add(this.processExitBountySize),
                                    gasPrice: this.dummyGasPrice,
                                },
                            ),
                            'Exit has already started.',
                        );
                    });

                    describe('When the NFT for the exit is generated', () => {
                        it('should have Alice as the owner of the token', async () => {
                            const nftOwner = await this.liquidity.ownerOf(this.exitId);
                            const aliceBalance = await this.liquidity.balanceOf(alice);
                            expect(nftOwner).to.equal(alice);
                            expect(aliceBalance).to.be.bignumber.equal(new BN(1));
                        });

                        it('should increase the total token supply by one', async () => {
                            const totalSupply = await this.liquidity.totalSupply();
                            expect(totalSupply).to.be.bignumber.equal(new BN(1));
                        });

                        describe('When Alice tries to claim exit Bond before the exit is processed', () => {
                            it('should not be successful', async () => {
                                await expectRevert(
                                    this.liquidity.withdrawExitBond(
                                        this.exitId,
                                        { from: alice },
                                    ),
                                    'Exit not Processed',
                                );
                            });
                        });

                        describe('And then Alice processes the exits after two weeks', () => {
                            before(async () => {
                                await time.increase(time.duration.weeks(2).add(time.duration.seconds(1)));

                                this.LCBalanceBeforeProcessExit = new BN(
                                    await web3.eth.getBalance(this.liquidity.address),
                                );

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

                            describe('When Alice tries to claim the exit bond back', () => {
                                before(async () => {
                                    this.aliceBalanceBeforeClaiming = new BN(await web3.eth.getBalance(alice));
                                    const { receipt } = await this.liquidity.withdrawExitBond(this.exitId, {
                                        from: alice,
                                    });
                                    this.aliceWithdrawalReceipt = receipt;
                                });

                                it('should return the exit bond to Alice', async () => {
                                    const actualAliceBalanceAfterClaiming = new BN(await web3.eth.getBalance(alice));
                                    const expectedAliceBalance = this.aliceBalanceBeforeClaiming.add(
                                        this.startStandardExitBondSize,
                                    ).sub(await spentOnGas(this.aliceWithdrawalReceipt));

                                    expect(actualAliceBalanceAfterClaiming).to.be.bignumber.equal(
                                        expectedAliceBalance,
                                    );
                                });

                                it('should not return the bond again', async () => {
                                    await expectRevert(
                                        this.liquidity.withdrawExitBond(
                                            this.exitId,
                                            { from: alice },
                                        ),
                                        'Exit Bond does not exist or has already been claimed',
                                    );
                                });
                            });

                            describe('When Alice tries to claim funds back through the NFT', () => {
                                before(async () => {
                                    this.aliceBalanceBeforeClaiming = new BN(await web3.eth.getBalance(alice));
                                    const { receipt } = await this.liquidity.withdrawExit(this.exitId, {
                                        from: alice,
                                    });
                                    this.aliceWithdrawalReceipt = receipt;
                                });

                                it('should return the output amount to Alice', async () => {
                                    const actualAliceBalanceAfterWithdrawal = new BN(await web3.eth.getBalance(alice));
                                    const expectedAliceBalance = this.aliceBalanceBeforeClaiming
                                        .add(new BN(this.transferTxObject.outputs[0].amount))
                                        .sub(await spentOnGas(this.aliceWithdrawalReceipt));

                                    expect(actualAliceBalanceAfterWithdrawal).to.be.bignumber.equal(
                                        expectedAliceBalance,
                                    );
                                });

                                it('should burn the NFT', async () => {
                                    await expectRevert(
                                        this.liquidity.ownerOf(this.exitId),
                                        'ERC721: owner query for nonexistent token',
                                    );
                                });

                                it('should not allow Alice to get withdrawal again', async () => {
                                    await expectRevert(
                                        this.liquidity.withdrawExit(this.exitId, { from: alice }),
                                        'ERC721: owner query for nonexistent token',
                                    );
                                });
                            });
                        });
                    });
                });
            });
            describe('Given Alice deposited ETH and transferred some value to the Liquidity Contract', () => {
                before(async () => {
                    await aliceDepositsETH();
                    await aliceTransferSomeEthToLC();
                });

                describe('And Alice starts the exit through LC and receives the NFT', () => {
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
                            {
                                from: alice,
                                value: this.startStandardExitBondSize.add(this.processExitBountySize),
                                gasPrice: this.dummyGasPrice,
                            },
                        );
                    });

                    describe('When Alice transfers the exit NFT to Bob', () => {
                        before(async () => {
                            this.exitId = await this.exitGame.getStandardExitId(
                                false,
                                this.transferTx,
                                this.transferUtxoPos,
                            );
                            await this.liquidity.safeTransferFrom(alice, bob, this.exitId, { from: alice });
                        });

                        it('should have Bob as the new owner of the exit token', async () => {
                            const nftOwner = await this.liquidity.ownerOf(this.exitId);
                            expect(nftOwner).to.equal(bob);
                        });

                        describe('And then someone processes the exits after two weeks', () => {
                            before(async () => {
                                await time.increase(time.duration.weeks(2).add(time.duration.seconds(1)));

                                await this.framework.processExits(config.registerKeys.vaultId.eth, ETH, 0, 1);
                            });

                            describe('When Alice tries to claim funds back', () => {
                                it('should not be successful', async () => {
                                    await expectRevert(
                                        this.liquidity.withdrawExit(this.exitId, { from: alice }),
                                        'Only the NFT owner of the respective exit can withdraw',
                                    );
                                });
                            });

                            describe('When Bob tries to get exit bond', () => {
                                it('should not be successful', async () => {
                                    await expectRevert(
                                        this.liquidity.withdrawExitBond(this.exitId, { from: bob }),
                                        'Only the Exit Initiator can claim the bond',
                                    );
                                });
                            });

                            describe('When Alice tries to get exit bond back', () => {
                                before(async () => {
                                    this.aliceBalanceBeforeClaiming = new BN(await web3.eth.getBalance(alice));
                                    const { receipt } = await this.liquidity.withdrawExitBond(this.exitId, {
                                        from: alice,
                                    });
                                    this.aliceWithdrawalReceipt = receipt;
                                });

                                it('should return the exit bond to Alice', async () => {
                                    const actualAliceBalanceAfterClaiming = new BN(await web3.eth.getBalance(alice));
                                    const expectedAliceBalance = this.aliceBalanceBeforeClaiming.add(
                                        this.startStandardExitBondSize,
                                    ).sub(await spentOnGas(this.aliceWithdrawalReceipt));

                                    expect(actualAliceBalanceAfterClaiming).to.be.bignumber.equal(
                                        expectedAliceBalance,
                                    );
                                });
                            });

                            describe('When Bob tries to claim funds back through the NFT', () => {
                                before(async () => {
                                    this.bobBalanceBeforeClaiming = new BN(await web3.eth.getBalance(bob));
                                    const { receipt } = await this.liquidity.withdrawExit(this.exitId, {
                                        from: bob,
                                    });
                                    this.bobWithdrawalReceipt = receipt;
                                });

                                it('should return the amount to Bob', async () => {
                                    const actualBobBalanceAfterWithdrawal = new BN(await web3.eth.getBalance(bob));
                                    const expectedBobBalance = this.bobBalanceBeforeClaiming
                                        .add(new BN(this.transferTxObject.outputs[0].amount))
                                        .sub(await spentOnGas(this.bobWithdrawalReceipt));

                                    expect(actualBobBalanceAfterWithdrawal).to.be.bignumber.equal(expectedBobBalance);
                                });

                                it('should burn the NFT', async () => {
                                    await expectRevert(
                                        this.liquidity.ownerOf(this.exitId),
                                        'ERC721: owner query for nonexistent token',
                                    );
                                });
                            });
                        });
                    });
                });
            });

            describe('Given Alice deposited with ERC20 token and transferred some to LC', () => {
                before(async () => {
                    await this.erc20.transfer(alice, DEPOSIT_VALUE, { from: richDad });
                    await this.erc20.approve(this.erc20Vault.address, DEPOSIT_VALUE, { from: alice });

                    await aliceDepositsErc20();
                    await this.framework.addExitQueue(config.registerKeys.vaultId.erc20, this.erc20.address);
                    await aliceTransferSomeErcToLC();
                });

                describe('When Alice tries to start the standard exit from the Liquidity Contract', () => {
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
                            {
                                from: alice,
                                value: this.startStandardExitBondSize.add(this.processExitBountySize),
                                gasPrice: this.dummyGasPrice,
                            },
                        );
                    });

                    it('should start the exit successully', async () => {
                        this.exitId = await this.exitGame.getStandardExitId(
                            false,
                            this.transferTx,
                            this.transferUtxoPos,
                        );
                        const exitIds = [this.exitId];
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

                    describe('And then someone processes the exits for the ERC20 token after a week', () => {
                        before(async () => {
                            await time.increase(time.duration.weeks(1).add(time.duration.seconds(1)));

                            this.LCErc20BalanceBeforeProcessExit = new BN(
                                await this.erc20.balanceOf(this.liquidity.address),
                            );
                            this.LCEthBalanceBeforeProcessExit = new BN(
                                await web3.eth.getBalance(this.liquidity.address),
                            );

                            await this.framework.processExits(
                                config.registerKeys.vaultId.erc20,
                                this.erc20.address,
                                0,
                                1,
                            );
                        });

                        it('should return the ERC20 tokens plus standard exit bond to the Liquidity Contract', async () => {
                            const actualLCBalanceAfterProcessExit = new BN(
                                await web3.eth.getBalance(this.liquidity.address),
                            );
                            const expectedLCBalance = this.LCEthBalanceBeforeProcessExit.add(
                                this.startStandardExitBondSize,
                            );

                            const actualLCErc20BalanceAfterProcessExit = new BN(
                                await this.erc20.balanceOf(this.liquidity.address),
                            );
                            const expectedLCErc20Balance = this.LCErc20BalanceBeforeProcessExit.add(
                                new BN(this.transferTxObject.outputs[0].amount),
                            );

                            expect(actualLCBalanceAfterProcessExit).to.be.bignumber.equal(expectedLCBalance);
                            expect(actualLCErc20BalanceAfterProcessExit).to.be.bignumber.equal(expectedLCErc20Balance);
                        });

                        describe('When Alice tries to get exit bond back', () => {
                            before(async () => {
                                this.aliceBalanceBeforeClaiming = new BN(await web3.eth.getBalance(alice));
                                const { receipt } = await this.liquidity.withdrawExitBond(this.exitId, {
                                    from: alice,
                                });
                                this.aliceWithdrawalReceipt = receipt;
                            });

                            it('should return the exit bond to Alice', async () => {
                                const actualAliceBalanceAfterClaiming = new BN(await web3.eth.getBalance(alice));
                                const expectedAliceBalance = this.aliceBalanceBeforeClaiming.add(
                                    this.startStandardExitBondSize,
                                ).sub(await spentOnGas(this.aliceWithdrawalReceipt));

                                expect(actualAliceBalanceAfterClaiming).to.be.bignumber.equal(
                                    expectedAliceBalance,
                                );
                            });
                        });

                        describe('When Alice tries to claim ERC20 funds back', () => {
                            before(async () => {
                                this.aliceErc20BalanceBeforeClaiming = new BN(await this.erc20.balanceOf(alice));
                                await this.liquidity.withdrawExit(this.exitId, {
                                    from: alice,
                                });
                            });

                            it('should return the tokens to Alice', async () => {
                                const actualAliceErc20BalanceAfterWithdrawal = new BN(
                                    await this.erc20.balanceOf(alice),
                                );
                                const expectedAliceErc20Balance = this.aliceErc20BalanceBeforeClaiming.add(
                                    new BN(this.transferTxObject.outputs[0].amount),
                                );

                                expect(actualAliceErc20BalanceAfterWithdrawal).to.be.bignumber.equal(
                                    expectedAliceErc20Balance,
                                );
                            });
                        });
                    });
                });
            });

            describe('Given Alice and Bob both deposited ETH and transferred some value to the Liquidity Contract', () => {
                before(async () => {
                    await aliceDepositsETH();
                    await aliceTransferSomeEthToLC();
                    await bobDepositsETH();
                    await bobTransferSomeEthToLC();
                });

                describe('When Alice starts the exit through LC', () => {
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
                            {
                                from: alice,
                                value: this.startStandardExitBondSize.add(this.processExitBountySize),
                                gasPrice: this.dummyGasPrice,
                            },
                        );
                    });

                    describe('And then the bond size is changed, Bob starts exit with new bond size after two days', () => {
                        before(async () => {
                            this.updatedStandardExitBondSize = new BN(8000000000000000);
                            await this.exitGame.updateStartStandardExitBondSize(this.updatedStandardExitBondSize, {
                                from: maintainer,
                            });
                            await time.increase(time.duration.days(2).add(time.duration.seconds(1)));

                            const utxoPos = this.bobTransferUtxoPos;
                            const rlpOutputTx = this.bobTransferTx;
                            const outputTxInclusionProof = this.bobMerkleProofForTransferTx;
                            const depositUtxoPos = this.bobDepositUtxoPos;
                            const rlpDepositTx = this.bobDepositTx;
                            const depositInclusionProof = this.bobMerkleProofForDepositTx;

                            await this.liquidity.startExit(
                                utxoPos,
                                rlpOutputTx,
                                outputTxInclusionProof,
                                rlpDepositTx,
                                depositInclusionProof,
                                depositUtxoPos,
                                {
                                    from: bob,
                                    value: this.updatedStandardExitBondSize.add(this.processExitBountySize),
                                    gasPrice: this.dummyGasPrice,
                                },
                            );
                        });

                        describe('And then someone processes the exits after two weeks', () => {
                            before(async () => {
                                await time.increase(time.duration.weeks(2).add(time.duration.seconds(1)));

                                await this.framework.processExits(config.registerKeys.vaultId.eth, ETH, 0, 2);
                            });

                            describe('When Alice tries to get exit bond back', () => {
                                before(async () => {
                                    this.aliceBalanceBeforeClaiming = new BN(await web3.eth.getBalance(alice));
                                    this.aliceExitId = await this.exitGame.getStandardExitId(
                                        false,
                                        this.transferTx,
                                        this.transferUtxoPos,
                                    );
                                    const { receipt } = await this.liquidity.withdrawExitBond(this.aliceExitId, {
                                        from: alice,
                                    });
                                    this.aliceWithdrawalReceipt = receipt;
                                });

                                it('should return the exit bond with older size to Alice', async () => {
                                    const actualAliceBalanceAfterClaiming = new BN(await web3.eth.getBalance(alice));
                                    const expectedAliceBalance = this.aliceBalanceBeforeClaiming.add(
                                        this.startStandardExitBondSize,
                                    ).sub(await spentOnGas(this.aliceWithdrawalReceipt));

                                    expect(actualAliceBalanceAfterClaiming).to.be.bignumber.equal(
                                        expectedAliceBalance,
                                    );
                                });
                            });

                            describe('When Bob tries to get exit bond back', () => {
                                before(async () => {
                                    this.bobBalanceBeforeClaiming = new BN(await web3.eth.getBalance(bob));
                                    this.bobExitId = await this.exitGame.getStandardExitId(
                                        false,
                                        this.bobTransferTx,
                                        this.bobTransferUtxoPos,
                                    );
                                    const { receipt } = await this.liquidity.withdrawExitBond(this.bobExitId, {
                                        from: bob,
                                    });
                                    this.bobWithdrawalReceipt = receipt;
                                });

                                it('should return the exit bond with new size to Bob', async () => {
                                    const actualBobBalanceAfterClaiming = new BN(await web3.eth.getBalance(bob));
                                    const expectedBobBalance = this.bobBalanceBeforeClaiming.add(
                                        this.updatedStandardExitBondSize,
                                    ).sub(await spentOnGas(this.bobWithdrawalReceipt));

                                    expect(actualBobBalanceAfterClaiming).to.be.bignumber.equal(
                                        expectedBobBalance,
                                    );
                                });
                            });
                        });
                    });
                });
            });
        });
    },
);
