const EthVault = artifacts.require('EthVault');
const Erc20Vault = artifacts.require('Erc20Vault');
const PaymentExitGame = artifacts.require('PaymentExitGame');
const PlasmaFramework = artifacts.require('PlasmaFramework');

const {
    BN, constants, expectEvent, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { EMPTY_BYTES, SAFE_GAS_STIPEND } = require('../helpers/constants.js');
const { MerkleTree } = require('../helpers/merkle.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../helpers/transaction.js');
const { computeNormalOutputId } = require('../helpers/utils.js');
const { sign } = require('../helpers/sign.js');
const { hashTx } = require('../helpers/paymentEip712.js');
const { buildUtxoPos } = require('../helpers/positions.js');
const Testlang = require('../helpers/testlang.js');
const config = require('../../config.js');

contract('PaymentExitGame - In-flight Exit - End to End Tests', ([_deployer, _maintainer, authority, carol, richFather]) => {
    const ETH = constants.ZERO_ADDRESS;
    const DEPOSIT_VALUE = 1000000;
    const TX_TYPE_PAYMENT = config.registerKeys.txTypes.payment;
    const OUTPUT_TYPE_PAYMENT = config.registerKeys.outputTypes.payment;
    const MERKLE_TREE_DEPTH = 16;

    const alicePrivateKey = '0x7151e5dab6f8e95b5436515b83f423c4df64fe4c6149f864daa209b26adb10ca';
    const bobPrivateKey = '0x7151e5dab6f8e95b5436515b83f423c4df64fe4c6149f864daa209b26adb10cb';
    let alice;
    let bob;

    const setupAccount = async () => {
        const password = 'password1234';
        alice = await web3.eth.personal.importRawKey(alicePrivateKey, password);
        alice = web3.utils.toChecksumAddress(alice);
        web3.eth.personal.unlockAccount(alice, password, 3600);
        web3.eth.sendTransaction({ to: alice, from: richFather, value: web3.utils.toWei('1', 'ether') });

        bob = await web3.eth.personal.importRawKey(bobPrivateKey, password);
        bob = web3.utils.toChecksumAddress(bob);
        web3.eth.personal.unlockAccount(bob, password, 3600);
        web3.eth.sendTransaction({ to: bob, from: richFather, value: web3.utils.toWei('1', 'ether') });
    };

    before(setupAccount);

    const setupContracts = async () => {
        this.framework = await PlasmaFramework.deployed();

        this.ethVault = await EthVault.at(await this.framework.vaults(config.registerKeys.vaultId.eth));
        this.erc20Vault = await Erc20Vault.at(await this.framework.vaults(config.registerKeys.vaultId.erc20));

        this.exitGame = await PaymentExitGame.at(await this.framework.exitGames(config.registerKeys.txTypes.payment));

        this.startIFEBondSize = await this.exitGame.startIFEBondSize();
        this.piggybackBondSize = await this.exitGame.piggybackBondSize();

        this.framework.addExitQueue(config.registerKeys.vaultId.eth, ETH);
    };

    const depositETH = async (depositor) => {
        const depositBlockNum = (await this.framework.nextDepositBlock()).toNumber();
        const depositUtxoPos = buildUtxoPos(depositBlockNum, 0, 0);
        const depositTx = Testlang.deposit(OUTPUT_TYPE_PAYMENT, DEPOSIT_VALUE, depositor);

        const merkleTreeForDepositTx = new MerkleTree([depositTx], MERKLE_TREE_DEPTH);
        const depositInclusionProof = merkleTreeForDepositTx.getInclusionProof(depositTx);

        const tx = await this.ethVault.deposit(depositTx, { from: depositor, value: DEPOSIT_VALUE });

        return {
            depositTx,
            depositUtxoPos,
            depositInclusionProof,
            tx,
        };
    };

    describe('Given contracts deployed, exit game and both ETH and ERC20 vault registered', () => {
        before(setupContracts);

        describe('>>> TEST CASE: Canonical Basic', () => {
            describe('Given Alice deposited ETH', () => {
                before(async () => {
                    const result = await depositETH(alice);

                    this.depositUtxoPos = result.depositUtxoPos;
                    this.depositTx = result.depositTx;
                    this.merkleProofForDepositTx = result.depositInclusionProof;
                });

                describe('Given Alice started a canonical in-flight exit from transaction to Bob that is not mined', () => {
                    before(async () => {
                        this.amountIFE = DEPOSIT_VALUE / 2;
                        const output = new PaymentTransactionOutput(OUTPUT_TYPE_PAYMENT, this.amountIFE, bob, ETH);
                        this.inFlightTx = new PaymentTransaction(
                            TX_TYPE_PAYMENT,
                            [this.depositUtxoPos],
                            [output],
                        );

                        this.inFlightTxRaw = web3.utils.bytesToHex(this.inFlightTx.rlpEncoded());
                        const inputTxs = [this.depositTx];
                        const inputUtxosPos = [this.depositUtxoPos];
                        const inputTxsInclusionProofs = [this.merkleProofForDepositTx];

                        const txHash = hashTx(this.inFlightTx, this.framework.address);
                        const signature = sign(txHash, alicePrivateKey);

                        const args = {
                            inFlightTx: this.inFlightTxRaw,
                            inputTxs,
                            inputUtxosPos,
                            inputTxsInclusionProofs,
                            inFlightTxWitnesses: [signature],
                        };

                        await this.exitGame.startInFlightExit(
                            args,
                            { from: alice, value: this.startIFEBondSize },
                        );

                        this.exitId = await this.exitGame.getInFlightExitId(this.inFlightTxRaw);
                    });

                    describe('And owner of the output (Bob) piggybacks', () => {
                        before(async () => {
                            this.exitingOutputIndex = 0;
                            const args = {
                                inFlightTx: this.inFlightTxRaw,
                                outputIndex: this.exitingOutputIndex,
                            };

                            this.piggybackTx = await this.exitGame.piggybackInFlightExitOnOutput(
                                args,
                                { from: bob, value: this.piggybackBondSize },
                            );
                        });

                        it('should emit InFlightExitOutputPiggybacked event', async () => {
                            await expectEvent.inLogs(
                                this.piggybackTx.logs,
                                'InFlightExitOutputPiggybacked',
                                {
                                    exitTarget: bob,
                                    txHash: web3.utils.sha3(this.inFlightTxRaw),
                                    outputIndex: new BN(this.exitingOutputIndex),
                                },
                            );
                        });

                        describe('And someone processes exits for ETH after two weeks', () => {
                            let preBalanceBob;

                            before(async () => {
                                preBalanceBob = new BN(await web3.eth.getBalance(bob));

                                await time.increase(time.duration.weeks(2).add(time.duration.seconds(1)));
                                this.exitsToProcess = 1;

                                this.processTx = await this.framework.processExits(
                                    config.registerKeys.vaultId.eth, ETH, 0, this.exitsToProcess,
                                );
                            });

                            it('should transfer the funds to the output owner (Bob)', async () => {
                                const postBalanceBob = new BN(await web3.eth.getBalance(bob));
                                const expectedBalance = preBalanceBob
                                    .add(new BN(this.piggybackBondSize))
                                    .add(new BN(this.amountIFE));

                                expect(postBalanceBob).to.be.bignumber.equal(expectedBalance);
                            });

                            it('should publish an event', async () => {
                                await expectEvent.inLogs(
                                    this.processTx.logs,
                                    'ProcessedExitsNum',
                                    {
                                        processedNum: new BN(this.exitsToProcess),
                                        vaultId: new BN(config.registerKeys.vaultId.eth),
                                        token: ETH,
                                    },
                                );
                            });

                            it('should mark output as spent', async () => {
                                const outputId = computeNormalOutputId(this.inFlightTxRaw, this.exitingOutputIndex);
                                expect(await this.framework.isOutputFinalized(outputId)).to.be.true;
                            });
                        });
                    });
                });
            });
        });

        describe('>>> TEST CASE: Non-Canonical Basic', () => {
            describe('Given Alice deposited ETH two times, creating output A and output B', () => {
                before(async () => {
                    this.outputAData = await depositETH(alice);
                    this.outputBData = await depositETH(alice);
                });

                describe('When Alice signs a tx1 to Bob using output A and output B as input', () => {
                    before(async () => {
                        const amount = DEPOSIT_VALUE / 2;
                        const output = new PaymentTransactionOutput(OUTPUT_TYPE_PAYMENT, amount, bob, ETH);
                        this.tx1 = new PaymentTransaction(
                            TX_TYPE_PAYMENT,
                            [this.outputAData.depositUtxoPos, this.outputBData.depositUtxoPos],
                            [output],
                        );

                        const txHash = hashTx(this.tx1, this.framework.address);
                        this.signatureTx1 = sign(txHash, alicePrivateKey);
                    });

                    describe('And then Alice also signs another competing tx2 to Carol using output A as input', () => {
                        before(async () => {
                            const amount = DEPOSIT_VALUE / 2;
                            const output = new PaymentTransactionOutput(OUTPUT_TYPE_PAYMENT, amount, carol, ETH);
                            this.tx2 = new PaymentTransaction(
                                TX_TYPE_PAYMENT,
                                [this.outputAData.depositUtxoPos],
                                [output],
                            );

                            const txHash = hashTx(this.tx2, this.framework.address);
                            this.signatureTx2 = sign(txHash, alicePrivateKey);
                        });

                        describe('When Bob starts IFE on tx1', () => {
                            before(async () => {
                                this.tx1RlpEncoded = web3.utils.bytesToHex(this.tx1.rlpEncoded());
                                const inputTxs = [this.outputAData.depositTx, this.outputBData.depositTx];
                                const inputTxTypes = [TX_TYPE_PAYMENT, TX_TYPE_PAYMENT];
                                const inputUtxosPos = [
                                    this.outputAData.depositUtxoPos, this.outputBData.depositUtxoPos,
                                ];
                                const inputTxsInclusionProofs = [
                                    this.outputAData.depositInclusionProof, this.outputBData.depositInclusionProof,
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
                            });

                            describe('And Bob piggybacks the output of tx1', () => {
                                before(async () => {
                                    const exitingOutputIndex = 0;
                                    const args = {
                                        inFlightTx: this.tx1RlpEncoded,
                                        outputIndex: exitingOutputIndex,
                                    };

                                    await this.exitGame.piggybackInFlightExitOnOutput(
                                        args,
                                        { from: bob, value: this.piggybackBondSize },
                                    );
                                });

                                describe('Then the IFE of tx1 is challenged non-canonical by Carol', () => {
                                    before(async () => {
                                        const args = {
                                            inputTx: this.outputAData.depositTx,
                                            inputUtxoPos: this.outputAData.depositUtxoPos,
                                            inFlightTx: this.tx1RlpEncoded,
                                            inFlightTxInputIndex: 0,
                                            competingTx: web3.utils.bytesToHex(this.tx2.rlpEncoded()),
                                            competingTxInputIndex: 0,
                                            competingTxPos: 0,
                                            competingTxInclusionProof: EMPTY_BYTES,
                                            competingTxWitness: this.signatureTx2,
                                        };

                                        await this.exitGame.challengeInFlightExitNotCanonical(
                                            args,
                                            { from: carol },
                                        );
                                    });

                                    describe('And then Alice piggybacks both outputs output A and output B', () => {
                                        before(async () => {
                                            const args1 = {
                                                inFlightTx: this.tx1RlpEncoded,
                                                inputIndex: 0,
                                            };

                                            const args2 = {
                                                inFlightTx: this.tx1RlpEncoded,
                                                inputIndex: 1,
                                            };

                                            await this.exitGame.piggybackInFlightExitOnInput(
                                                args1,
                                                { from: alice, value: this.piggybackBondSize },
                                            );

                                            await this.exitGame.piggybackInFlightExitOnInput(
                                                args2,
                                                { from: alice, value: this.piggybackBondSize },
                                            );
                                        });

                                        describe('And then the piggyback of output A is challenged with tx2', () => {
                                            before(async () => {
                                                const args = {
                                                    inFlightTx: this.tx1RlpEncoded,
                                                    inFlightTxInputIndex: 0,
                                                    challengingTx: web3.utils.bytesToHex(this.tx2.rlpEncoded()),
                                                    challengingTxInputIndex: 0,
                                                    challengingTxWitness: this.signatureTx2,
                                                    inputTx: this.outputAData.depositTx,
                                                    inputUtxoPos: this.outputAData.depositUtxoPos,
                                                };
                                                await this.exitGame.challengeInFlightExitInputSpent(
                                                    args,
                                                    { from: carol },
                                                );
                                            });

                                            describe('When someone processes exits after two weeks', () => {
                                                let preBalanceAlice;
                                                let preBalanceBob;

                                                before(async () => {
                                                    preBalanceAlice = new BN(await web3.eth.getBalance(alice));
                                                    preBalanceBob = new BN(await web3.eth.getBalance(bob));

                                                    const slightlyMoreThanTwoWeeks = (
                                                        time.duration.weeks(2).add(time.duration.seconds(1))
                                                    );
                                                    await time.increase(slightlyMoreThanTwoWeeks);
                                                    const exitsToProcess = 1;

                                                    await this.framework.processExits(
                                                        config.registerKeys.vaultId.eth, ETH, 0, exitsToProcess,
                                                    );
                                                });

                                                it('should return only funds of output B to Alice (input exited)', async () => {
                                                    const postBalanceAlice = new BN(await web3.eth.getBalance(alice));
                                                    const expectedBalance = preBalanceAlice
                                                        .add(new BN(DEPOSIT_VALUE))
                                                        .add(new BN(this.piggybackBondSize));

                                                    expect(expectedBalance).to.be.bignumber.equal(postBalanceAlice);
                                                });

                                                it('should NOT return fund to Bob (output not exited)', async () => {
                                                    const postBalanceBob = new BN(await web3.eth.getBalance(bob));
                                                    expect(preBalanceBob).to.be.bignumber.equal(postBalanceBob);
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

        // test for issue: https://github.com/omisego/plasma-contracts/issues/470
        describe('>>> TEST CASE: Competing IFEs With One Canonical And The Other Non Canonical', () => {
            describe('Given Alice and Bob deposits, creating output A and output B respectively', () => {
                before(async () => {
                    this.outputAData = await depositETH(alice);
                    this.outputBData = await depositETH(bob);
                });

                describe('Given Alice and Bob both sign the tx1 spending output A and output B as input', () => {
                    before(async () => {
                        const amount = DEPOSIT_VALUE / 2;
                        const output = new PaymentTransactionOutput(OUTPUT_TYPE_PAYMENT, amount, carol, ETH);
                        this.tx1 = new PaymentTransaction(
                            TX_TYPE_PAYMENT,
                            [this.outputAData.depositUtxoPos, this.outputBData.depositUtxoPos],
                            [output],
                        );

                        const txHash = hashTx(this.tx1, this.framework.address);
                        this.signatureAliceTx1 = sign(txHash, alicePrivateKey);
                        this.signatureBobTx1 = sign(txHash, bobPrivateKey);
                    });

                    describe('And then Bob signs another tx2 spending output B', () => {
                        before(async () => {
                            const amount = DEPOSIT_VALUE / 2;
                            const output = new PaymentTransactionOutput(OUTPUT_TYPE_PAYMENT, amount, bob, ETH);
                            this.tx2 = new PaymentTransaction(
                                TX_TYPE_PAYMENT,
                                [this.outputBData.depositUtxoPos],
                                [output],
                            );

                            const txHash = hashTx(this.tx2, this.framework.address);
                            this.signatureBobTx2 = sign(txHash, bobPrivateKey);
                        });

                        describe('Bob starts IFE for tx2 first', () => {
                            before(async () => {
                                const args = {
                                    inFlightTx: web3.utils.bytesToHex(this.tx2.rlpEncoded()),
                                    inputTxs: [this.outputBData.depositTx],
                                    inputTxTypes: [TX_TYPE_PAYMENT],
                                    inputUtxosPos: [this.outputBData.depositUtxoPos],
                                    inputTxsInclusionProofs: [this.outputBData.depositInclusionProof],
                                    inFlightTxWitnesses: [this.signatureBobTx2],
                                };

                                await this.exitGame.startInFlightExit(
                                    args,
                                    { from: bob, value: this.startIFEBondSize },
                                );
                            });

                            describe('Nex Alice starts IFE for tx1', () => {
                                before(async () => {
                                    const tx1RlpEncoded = web3.utils.bytesToHex(this.tx1.rlpEncoded());
                                    const inputTxs = [this.outputAData.depositTx, this.outputBData.depositTx];
                                    const inputTxTypes = [TX_TYPE_PAYMENT, TX_TYPE_PAYMENT];
                                    const inputUtxosPos = [
                                        this.outputAData.depositUtxoPos, this.outputBData.depositUtxoPos,
                                    ];
                                    const inputTxsInclusionProofs = [
                                        this.outputAData.depositInclusionProof, this.outputBData.depositInclusionProof,
                                    ];

                                    const args = {
                                        inFlightTx: tx1RlpEncoded,
                                        inputTxs,
                                        inputTxTypes,
                                        inputUtxosPos,
                                        inputTxsInclusionProofs,
                                        inFlightTxWitnesses: [this.signatureAliceTx1, this.signatureBobTx1],
                                    };

                                    await this.exitGame.startInFlightExit(
                                        args,
                                        { from: alice, value: this.startIFEBondSize },
                                    );
                                });

                                describe('Both IFEs are challenged non-canonical', () => {
                                    before(async () => {
                                        const argsTx1 = {
                                            inputTx: this.outputBData.depositTx,
                                            inputUtxoPos: this.outputBData.depositUtxoPos,
                                            inFlightTx: web3.utils.bytesToHex(this.tx1.rlpEncoded()),
                                            inFlightTxInputIndex: 1,
                                            competingTx: web3.utils.bytesToHex(this.tx2.rlpEncoded()),
                                            competingTxInputIndex: 0,
                                            competingTxPos: 0,
                                            competingTxInclusionProof: EMPTY_BYTES,
                                            competingTxWitness: this.signatureBobTx2,
                                        };

                                        await this.exitGame.challengeInFlightExitNotCanonical(argsTx1);

                                        const argsTx2 = {
                                            inputTx: this.outputBData.depositTx,
                                            inputUtxoPos: this.outputBData.depositUtxoPos,
                                            inFlightTx: web3.utils.bytesToHex(this.tx2.rlpEncoded()),
                                            inFlightTxInputIndex: 0,
                                            competingTx: web3.utils.bytesToHex(this.tx1.rlpEncoded()),
                                            competingTxInputIndex: 1,
                                            competingTxPos: 0,
                                            competingTxInclusionProof: EMPTY_BYTES,
                                            competingTxWitness: this.signatureBobTx1,
                                        };

                                        await this.exitGame.challengeInFlightExitNotCanonical(argsTx2);
                                    });

                                    describe('Suddenly Operator (Authority) includes tx2 and respond to the IFE of tx2', () => {
                                        before(async () => {
                                            const rlpTx2 = web3.utils.bytesToHex(this.tx2.rlpEncoded());
                                            const merkleTree = new MerkleTree([rlpTx2], MERKLE_TREE_DEPTH);
                                            const inclusionProof = merkleTree.getInclusionProof(rlpTx2);

                                            const nextBlockNum = (await this.framework.nextChildBlock()).toNumber();
                                            const tx2Position = buildUtxoPos(nextBlockNum, 0, 0);

                                            await this.framework.submitBlock(merkleTree.root, { from: authority });

                                            await this.exitGame.respondToNonCanonicalChallenge(
                                                web3.utils.bytesToHex(this.tx2.rlpEncoded()),
                                                tx2Position,
                                                inclusionProof,
                                                { from: authority },
                                            );
                                        });

                                        describe('Alice piggybacks the input of tx1 and Bob piggybacks the output of tx2', () => {
                                            before(async () => {
                                                const piggybackInputArgs = {
                                                    inFlightTx: web3.utils.bytesToHex(this.tx1.rlpEncoded()),
                                                    inputIndex: 0,
                                                };
                                                await this.exitGame.piggybackInFlightExitOnInput(
                                                    piggybackInputArgs,
                                                    { from: alice, value: this.piggybackBondSize },
                                                );

                                                const piggybackOutputArgs = {
                                                    inFlightTx: web3.utils.bytesToHex(this.tx2.rlpEncoded()),
                                                    outputIndex: 0,
                                                };
                                                await this.exitGame.piggybackInFlightExitOnOutput(
                                                    piggybackOutputArgs,
                                                    { from: bob, value: this.piggybackBondSize },
                                                );
                                            });

                                            describe('Someone processes both exits after 2 weeks', () => {
                                                let preBalanceAlice;
                                                let preBalanceBob;
                                                let preBalanceAuthority;

                                                before(async () => {
                                                    preBalanceAlice = new BN(await web3.eth.getBalance(alice));
                                                    preBalanceBob = new BN(await web3.eth.getBalance(bob));
                                                    preBalanceAuthority = new BN(await web3.eth.getBalance(authority));

                                                    const slightlyMoreThanTwoWeeks = (
                                                        time.duration.weeks(2).add(time.duration.seconds(1))
                                                    );
                                                    await time.increase(slightlyMoreThanTwoWeeks);
                                                    const exitsToProcess = 2;

                                                    await this.framework.processExits(
                                                        config.registerKeys.vaultId.eth, ETH, 0, exitsToProcess,
                                                    );
                                                });

                                                it('should exit the output of tx2 to Bob', async () => {
                                                    const postBalanceBob = new BN(await web3.eth.getBalance(bob));
                                                    const expectedBalance = preBalanceBob
                                                        .add(new BN(this.tx2.outputs[0].amount))
                                                        .add(new BN(this.piggybackBondSize));
                                                    expect(expectedBalance).to.be.bignumber.equal(postBalanceBob);
                                                });

                                                it('should return IFE bond for tx2 to IFE responder (Operator)', async () => {
                                                    const postBalanceAuthority = new BN(
                                                        await web3.eth.getBalance(authority),
                                                    );
                                                    const expectedBalance = preBalanceAuthority
                                                        .add(new BN(this.startIFEBondSize));
                                                    expect(expectedBalance).to.be.bignumber.equal(postBalanceAuthority);
                                                });

                                                it('should exit the input of tx1 to Alice', async () => {
                                                    const postBalanceAlice = new BN(await web3.eth.getBalance(alice));
                                                    const expectedBalance = preBalanceAlice
                                                        .add(new BN(DEPOSIT_VALUE))
                                                        .add(new BN(this.piggybackBondSize));

                                                    expect(expectedBalance).to.be.bignumber.equal(postBalanceAlice);
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
});
