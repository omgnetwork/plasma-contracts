const EthVault = artifacts.require('EthVault');
const Erc20Vault = artifacts.require('Erc20Vault');
const ExitableTimestamp = artifacts.require('ExitableTimestampWrapper');
const ExitPriority = artifacts.require('ExitPriorityWrapper');
const ERC20Mintable = artifacts.require('ERC20Mintable');
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

contract('PaymentExitGame - In-flight Exit - End to End Tests', ([_deployer, _maintainer, _authority, bob, richFather]) => {
    const ETH = constants.ZERO_ADDRESS;
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

    before(setupAccount);

    const setupContracts = async () => {
        this.framework = await PlasmaFramework.deployed();

        this.ethVault = await EthVault.at(await this.framework.vaults(config.registerKeys.vaultId.eth));
        this.erc20Vault = await Erc20Vault.at(await this.framework.vaults(config.registerKeys.vaultId.erc20));

        this.exitGame = await PaymentExitGame.at(await this.framework.exitGames(config.registerKeys.txTypes.payment));

        this.startStandardExitBondSize = await this.exitGame.startStandardExitBondSize();
        this.startIFEBondSize = await this.exitGame.startIFEBondSize();
        this.piggybackBondSize = await this.exitGame.piggybackBondSize();

        this.framework.addExitQueue(config.registerKeys.vaultId.eth, ETH);
    };

    const aliceDepositsETH = async () => {
        const depositBlockNum = (await this.framework.nextDepositBlock()).toNumber();
        this.depositUtxoPos = buildUtxoPos(depositBlockNum, 0, 0);
        this.depositTx = Testlang.deposit(OUTPUT_TYPE_PAYMENT, DEPOSIT_VALUE, alice);
        const merkleTreeForDepositTx = new MerkleTree([this.depositTx], MERKLE_TREE_DEPTH);
        this.merkleProofForDepositTx = merkleTreeForDepositTx.getInclusionProof(this.depositTx);

        return this.ethVault.deposit(this.depositTx, { from: alice, value: DEPOSIT_VALUE });
    };

    describe('Given contracts deployed, exit game and both ETH and ERC20 vault registered', () => {
        before(setupContracts);

        describe('Given Alice deposited ETH', () => {
            before(async () => {
                await aliceDepositsETH();
            });

            describe('Given Alice started an in-flight exit from transaction to Bob that is not mined', () => {
                before(async () => {
                    this.amountIFE = DEPOSIT_VALUE / 2;
                    const output = new PaymentTransactionOutput(OUTPUT_TYPE_PAYMENT, this.amountIFE, bob, ETH);
                    this.inFlightTx = new PaymentTransaction(
                        config.registerKeys.txTypes.payment,
                        [this.depositUtxoPos],
                        [output],
                    );

                    this.inFlightTxRaw = web3.utils.bytesToHex(this.inFlightTx.rlpEncoded());
                    const inputTxs = [this.depositTx];
                    const inputTxTypes = [config.registerKeys.txTypes.payment];
                    const inputUtxosPos = [this.depositUtxoPos];
                    const outputGuardPreimagesForInputs = [EMPTY_BYTES];
                    const inputTxsInclusionProofs = [this.merkleProofForDepositTx];
                    const inputTxsConfirmSigs = [EMPTY_BYTES];

                    const txHash = hashTx(this.inFlightTx, this.framework.address);
                    const signature = sign(txHash, alicePrivateKey);

                    const args = {
                        inFlightTx: this.inFlightTxRaw,
                        inputTxs,
                        inputTxTypes,
                        inputUtxosPos,
                        outputGuardPreimagesForInputs,
                        inputTxsInclusionProofs,
                        inputTxsConfirmSigs,
                        inFlightTxWitnesses: [signature],
                        inputSpendingConditionOptionalArgs: [EMPTY_BYTES],
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
                            outputGuardPreimage: EMPTY_BYTES,
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

                        it('should exit the fund to the output owner (Bob)', async () => {
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
                            expect(await this.framework.isOutputSpent(outputId)).to.be.true;
                        });
                    });
                });
            });
        });
    });
});
