const EthVault = artifacts.require('EthVault');
const DexMockExitGame = artifacts.require('DummyDexMockExitGame');
const OutputGuardHandlerRegistry = artifacts.require('OutputGuardHandlerRegistry');
const PaymentExitGame = artifacts.require('PaymentExitGame');
const PaymentOutputV2GuardHandler = artifacts.require('PaymentOutputV2MockGuardHandler');
const PaymentOutputToPaymentTxCondition = artifacts.require('PaymentOutputToPaymentTxCondition');
const PaymentOutputToDexMockCondition = artifacts.require('PaymentOutputToDexMockCondition');
const PaymentTransactionStateTransitionVerifier = artifacts.require('PaymentTransactionStateTransitionVerifier');
const PlasmaFramework = artifacts.require('PlasmaFramework');
const SampleTxVerifierSupportsMVP = artifacts.require('SampleTxVerifierSupportsMVP');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');

const {
    BN, constants, expectEvent, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const config = require('../../config.js');

const { EMPTY_BYTES } = require('../helpers/constants.js');
const {
    PaymentTransactionOutput, PaymentTransaction, WireTransaction,
} = require('../helpers/transaction.js');
const { buildUtxoPos, buildTxPos } = require('../helpers/positions.js');
const Testlang = require('../helpers/testlang.js');
const { MerkleTree } = require('../helpers/merkle.js');
const { buildOutputGuard, computeNormalOutputId } = require('../helpers/utils.js');
const { hashTx } = require('../helpers/paymentEip712.js');
const { sign } = require('../helpers/sign.js');

/**
 * First three accounts are in the order of (deployer, maintainer, authority).
 * This is how migration scripts use the account.
 */
contract('PlasmaFramework - Extendibility End to End Tests', ([_, maintainer, authority, richFather]) => {
    const MERKLE_TREE_DEPTH = 16;
    const ETH = constants.ZERO_ADDRESS;
    const PAYMENT_OUTPUT_V2_TYPE = 2;
    const PAYMENT_V2_TX_TYPE = config.registerKeys.txTypes.paymentV2;
    const DEX_MOCK_TX_TYPE = 3;
    const DEPOSIT_VALUE = 1000000;
    const DUMMY_DEX_NONCE = 123;

    const alicePrivateKey = '0x7151e5dab6f8e95b5436515b83f423c4df64fe4c6149f864daa209b26adb10ca';
    const venuePrivateKey = '0x7151e5dab6f8e95b5436515b83f423c4df64fe4c6149f864daa209b26adb10cb';
    let alice;
    let venue;

    const setupAccount = async () => {
        const password = 'password1234';
        alice = await web3.eth.personal.importRawKey(alicePrivateKey, password);
        alice = web3.utils.toChecksumAddress(alice);
        web3.eth.personal.unlockAccount(alice, password, 3600);
        web3.eth.sendTransaction({ to: alice, from: richFather, value: web3.utils.toWei('1', 'ether') });

        venue = await web3.eth.personal.importRawKey(venuePrivateKey, password);
        venue = web3.utils.toChecksumAddress(venue);
        web3.eth.personal.unlockAccount(venue, password, 3600);
        web3.eth.sendTransaction({ to: venue, from: richFather, value: web3.utils.toWei('1', 'ether') });
    };

    describe('Given PlasmaFramework, ETH Vault and PaymentExitGame deployed', () => {
        before(async () => {
            await setupAccount();

            this.framework = await PlasmaFramework.deployed();
            this.ethVault = await EthVault.at(await this.framework.vaults(config.registerKeys.vaultId.eth));
            this.paymentExitGame = await PaymentExitGame.at(
                await this.framework.exitGames(config.registerKeys.txTypes.payment),
            );

            this.framework.addExitQueue(config.registerKeys.vaultId.eth, ETH);
        });

        describe('When Maintainer registers new Exit Game contracts for PaymentExitGame V2 and DEX (mock)', () => {
            before(async () => {
                const outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();
                const paymentOutputV2GuardHandler = await PaymentOutputV2GuardHandler.new();
                await outputGuardHandlerRegistry.registerOutputGuardHandler(
                    PAYMENT_OUTPUT_V2_TYPE, paymentOutputV2GuardHandler.address,
                );
                await outputGuardHandlerRegistry.renounceOwnership();

                const spendingConditionRegistry = await SpendingConditionRegistry.new();
                const paymentToPaymentCondition = await PaymentOutputToPaymentTxCondition.new(
                    this.framework.address, PAYMENT_V2_TX_TYPE, PAYMENT_V2_TX_TYPE,
                );
                const paymentToDexCondition = await PaymentOutputToDexMockCondition.new(
                    this.framework.address, PAYMENT_V2_TX_TYPE, DEX_MOCK_TX_TYPE,
                );
                await spendingConditionRegistry.registerSpendingCondition(
                    PAYMENT_OUTPUT_V2_TYPE, PAYMENT_V2_TX_TYPE, paymentToPaymentCondition.address,
                );
                await spendingConditionRegistry.registerSpendingCondition(
                    PAYMENT_OUTPUT_V2_TYPE, DEX_MOCK_TX_TYPE, paymentToDexCondition.address,
                );
                await spendingConditionRegistry.renounceOwnership();

                const stateVerifier = await PaymentTransactionStateTransitionVerifier.new();
                const txFinalizationVerifier = await SampleTxVerifierSupportsMVP.new();

                const paymentV2Args = [
                    this.framework.address,
                    config.registerKeys.vaultId.eth,
                    config.registerKeys.vaultId.erc20,
                    outputGuardHandlerRegistry.address,
                    spendingConditionRegistry.address,
                    stateVerifier.address,
                    txFinalizationVerifier.address,
                    PAYMENT_V2_TX_TYPE,
                    config.frameworks.safeGasStipend.v1,
                ];
                this.paymentV2ExitGame = await PaymentExitGame.new(paymentV2Args);

                await this.framework.registerExitGame(
                    PAYMENT_V2_TX_TYPE,
                    this.paymentV2ExitGame.address,
                    config.frameworks.protocols.moreVp,
                    { from: maintainer },
                );

                this.dexMockExitGame = await DexMockExitGame.new();
                await this.framework.registerExitGame(
                    DEX_MOCK_TX_TYPE,
                    this.dexMockExitGame.address,
                    config.frameworks.protocols.mvp,
                    { from: maintainer },
                );
            });

            it('should have Payment V2 and Dex (mock) exit game registered', async () => {
                expect(await this.framework.exitGames(PAYMENT_V2_TX_TYPE)).to.equal(this.paymentV2ExitGame.address);
                expect(await this.framework.exitGames(DEX_MOCK_TX_TYPE)).to.equal(this.dexMockExitGame.address);
            });

            describe('And then waits for 3 weeks', () => {
                before(async () => {
                    await time.increase(time.duration.weeks(3).add(time.duration.seconds(1)));
                });

                describe('Given Alice deposited with ETH via Payment transaction', () => {
                    beforeEach(async () => {
                        const depositBlockNum = (await this.framework.nextDepositBlock()).toNumber();
                        this.depositUtxoPos = buildUtxoPos(depositBlockNum, 0, 0);
                        this.depositTx = Testlang.deposit(
                            config.registerKeys.outputTypes.payment, DEPOSIT_VALUE, alice,
                        );
                        const merkleTreeForDepositTx = new MerkleTree([this.depositTx], MERKLE_TREE_DEPTH);
                        this.merkleProofForDepositTx = merkleTreeForDepositTx.getInclusionProof(this.depositTx);

                        await this.ethVault.deposit(this.depositTx, { from: alice, value: DEPOSIT_VALUE });
                    });

                    describe('When Alice spends the deposit (Payment tx) in a Payment V2 transaction', () => {
                        beforeEach(async () => {
                            this.dexOutputGuardPreimage = web3.eth.abi.encodeParameters([
                                'address', 'address', 'uint256',
                            ], [
                                venue,
                                alice, // trader
                                DUMMY_DEX_NONCE,
                            ]);
                            const dexOutputGuard = buildOutputGuard(this.dexOutputGuardPreimage);
                            const dexDepositAmount = 1000;
                            const dexDepositOutput = new PaymentTransactionOutput(
                                PAYMENT_OUTPUT_V2_TYPE, dexDepositAmount, dexOutputGuard, ETH,
                            );
                            const paymentV2TxBlockNum = (await this.framework.nextChildBlock()).toNumber();
                            const dexDepositOutputIndex = 0;
                            this.dexDepositUtxoPos = buildUtxoPos(paymentV2TxBlockNum, 0, dexDepositOutputIndex);

                            const paymentOutputV2 = new PaymentTransactionOutput(
                                PAYMENT_OUTPUT_V2_TYPE, DEPOSIT_VALUE - dexDepositAmount, alice, ETH,
                            );

                            this.paymentV2TxObject = new PaymentTransaction(
                                PAYMENT_V2_TX_TYPE, [this.depositUtxoPos], [dexDepositOutput, paymentOutputV2],
                            );
                            this.paymentV2Tx = web3.utils.bytesToHex(this.paymentV2TxObject.rlpEncoded());
                            const merkleTreeForPaymentV2Tx = new MerkleTree([this.paymentV2Tx]);
                            this.merkleProofForPaymentV2Tx = merkleTreeForPaymentV2Tx.getInclusionProof(
                                this.paymentV2Tx,
                            );

                            this.dexDepositOutputId = computeNormalOutputId(this.paymentV2Tx, dexDepositOutputIndex);

                            await this.framework.submitBlock(merkleTreeForPaymentV2Tx.root, { from: authority });
                        });

                        describe('And then spends Payment V2 output in DEX (mock) transaction', () => {
                            beforeEach(async () => {
                                // cheat by making the DEX tx no output, not testing the ability to exit DEX anyway
                                this.dexTxObject = new WireTransaction(
                                    DEX_MOCK_TX_TYPE, [this.dexDepositOutputId], [],
                                );
                                this.dexTx = this.dexTxObject.rlpEncoded();
                                this.merkleTreeForDexTx = new MerkleTree([this.dexTx]);
                                this.merkleProofForDexTx = this.merkleTreeForDexTx.getInclusionProof(
                                    this.dexTx,
                                );

                                const dexTxBlockNum = (await this.framework.nextChildBlock()).toNumber();
                                this.dexTxPos = buildTxPos(dexTxBlockNum, 0);
                                await this.framework.submitBlock(this.merkleTreeForDexTx.root, { from: authority });
                            });

                            describe('When Alice starts exit from the ETH deposit transaction (Payment tx)', () => {
                                beforeEach(async () => {
                                    const args = {
                                        utxoPos: this.depositUtxoPos,
                                        rlpOutputTx: this.depositTx,
                                        outputType: config.registerKeys.outputTypes.payment,
                                        outputGuardPreimage: EMPTY_BYTES,
                                        outputTxInclusionProof: this.merkleProofForDepositTx,
                                    };

                                    const bondSize = await this.paymentExitGame.startStandardExitBondSize();
                                    await this.paymentExitGame.startStandardExit(
                                        args, { from: alice, value: bondSize },
                                    );
                                });

                                it('should be challenged successfully since spent by Payment V2 tx', async () => {
                                    const txHash = hashTx(this.paymentV2TxObject, this.framework.address);
                                    const signature = sign(txHash, alicePrivateKey);
                                    const exitId = await this.paymentExitGame.getStandardExitId(
                                        true, this.depositTx, this.depositUtxoPos,
                                    );

                                    const args = {
                                        exitId: exitId.toString(10),
                                        exitingTx: this.depositTx,
                                        challengeTx: this.paymentV2Tx,
                                        inputIndex: 0,
                                        witness: signature,
                                        spendingConditionOptionalArgs: EMPTY_BYTES,
                                        outputGuardPreimage: EMPTY_BYTES,
                                        challengeTxPos: 0,
                                        challengeTxInclusionProof: EMPTY_BYTES,
                                        challengeTxConfirmSig: EMPTY_BYTES,
                                    };

                                    const challengeTx = await this.paymentExitGame.challengeStandardExit(
                                        args, { from: alice },
                                    );
                                    await expectEvent.inLogs(
                                        challengeTx.logs,
                                        'ExitChallenged',
                                        { utxoPos: new BN(this.depositUtxoPos) },
                                    );
                                });
                            });

                            describe('When Alice tries to exit the Dex deposit output in Payment V2 transaction', () => {
                                beforeEach(async () => {
                                    const args = {
                                        utxoPos: this.dexDepositUtxoPos,
                                        rlpOutputTx: this.paymentV2Tx,
                                        outputType: PAYMENT_OUTPUT_V2_TYPE,
                                        outputGuardPreimage: this.dexOutputGuardPreimage,
                                        outputTxInclusionProof: this.merkleProofForPaymentV2Tx,
                                    };

                                    const bondSize = await this.paymentV2ExitGame.startStandardExitBondSize();
                                    await this.paymentV2ExitGame.startStandardExit(
                                        args, { from: alice, value: bondSize },
                                    );
                                });

                                it('should be challenged successfully since spent by DEX (mock) tx', async () => {
                                    const txHash = web3.utils.soliditySha3(
                                        { t: 'bytes', v: web3.utils.bytesToHex(this.dexTx) },
                                    );
                                    // dex (mock) uses venue's signature
                                    const signature = sign(txHash, venuePrivateKey);
                                    const confirmSignature = sign(this.merkleTreeForDexTx.root, venuePrivateKey);

                                    const exitId = await this.paymentV2ExitGame.getStandardExitId(
                                        false, this.paymentV2Tx, this.dexDepositUtxoPos,
                                    );

                                    const args = {
                                        exitId: exitId.toString(10),
                                        exitingTx: this.paymentV2Tx,
                                        challengeTx: this.dexTx,
                                        inputIndex: 0,
                                        witness: signature,
                                        // Dex (mock) spending condition requires preimage as optional arg
                                        spendingConditionOptionalArgs: this.dexOutputGuardPreimage,
                                        outputGuardPreimage: this.dexOutputGuardPreimage,
                                        challengeTxPos: this.dexTxPos,
                                        challengeTxInclusionProof: this.merkleProofForDexTx,
                                        challengeTxConfirmSig: confirmSignature,
                                    };

                                    const challengeTx = await this.paymentV2ExitGame.challengeStandardExit(
                                        args, { from: alice },
                                    );
                                    await expectEvent.inLogs(
                                        challengeTx.logs,
                                        'ExitChallenged',
                                        { utxoPos: new BN(this.dexDepositUtxoPos) },
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
