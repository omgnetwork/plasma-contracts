const ExitableTimestamp = artifacts.require('ExitableTimestampWrapper');
const ExitId = artifacts.require('ExitIdWrapper');
const ExpectedOutputGuardHandler = artifacts.require('ExpectedOutputGuardHandler');
const IsDeposit = artifacts.require('IsDepositWrapper');
const OutputGuardHandlerRegistry = artifacts.require('OutputGuardHandlerRegistry');
const PaymentInFlightExitRouter = artifacts.require('PaymentInFlightExitRouterMock');
const PaymentStartInFlightExit = artifacts.require('PaymentStartInFlightExit');
const PaymentPiggybackInFlightExit = artifacts.require('PaymentPiggybackInFlightExit');
const PaymentProcessInFlightExit = artifacts.require('PaymentProcessInFlightExit');
const PaymentChallengeIFENotCanonical = artifacts.require('PaymentChallengeIFENotCanonical');
const PaymentChallengeIFEInputSpent = artifacts.require('PaymentChallengeIFEInputSpent');
const PaymentChallengeIFEOutputSpent = artifacts.require('PaymentChallengeIFEOutputSpent');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const SpendingConditionMock = artifacts.require('SpendingConditionMock');
const StateTransitionVerifierMock = artifacts.require('StateTransitionVerifierMock');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { buildUtxoPos, UtxoPos } = require('../../../helpers/positions.js');
const { computeNormalOutputId, spentOnGas } = require('../../../helpers/utils.js');
const { PROTOCOL } = require('../../../helpers/constants.js');
const { sign } = require('../../../helpers/sign.js');
const {
    buildValidIfeStartArgs, buildIfeStartArgs, createInputTransaction, createDepositTransaction, createInFlightTx,
} = require('../../../helpers/ife.js');

contract('PaymentInFlightExitRouter', ([_, alice, richFather, carol]) => {
    const CHILD_BLOCK_INTERVAL = 1000;
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week in seconds
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const OUTPUT_TYPE_ONE = 1;
    const OUTPUT_TYPE_TWO = 2;
    const IFE_TX_TYPE = 1;
    const INCLUSION_PROOF_LENGTH_IN_BYTES = 512;
    const BLOCK_NUMBER = 1000;
    const DEPOSIT_BLOCK_NUMBER = BLOCK_NUMBER + 1;
    const DUMMY_INPUT_1 = '0x0000000000000000000000000000000000000000000000000000000000000001';
    const AMOUNT = 10;
    const TOLERANCE_SECONDS = new BN(1);
    const bobPrivateKey = '0x7151e5dab6f8e95b5436515b83f423c4df64fe4c6149f864daa209b26adb10ca';
    let bob;

    before('deploy and link with controller lib', async () => {
        const startInFlightExit = await PaymentStartInFlightExit.new();
        const piggybackInFlightExit = await PaymentPiggybackInFlightExit.new();
        const challengeInFlightExitNotCanonical = await PaymentChallengeIFENotCanonical.new();
        const challengeIFEInputSpent = await PaymentChallengeIFEInputSpent.new();
        const challengeIFEOutputSpent = await PaymentChallengeIFEOutputSpent.new();
        const processInFlightExit = await PaymentProcessInFlightExit.new();

        await PaymentInFlightExitRouter.link('PaymentStartInFlightExit', startInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentPiggybackInFlightExit', piggybackInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFENotCanonical', challengeInFlightExitNotCanonical.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFEInputSpent', challengeIFEInputSpent.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFEOutputSpent', challengeIFEOutputSpent.address);
        await PaymentInFlightExitRouter.link('PaymentProcessInFlightExit', processInFlightExit.address);
    });

    before('setup bob account with custom private key', async () => {
        const password = 'password1234';
        bob = await web3.eth.personal.importRawKey(bobPrivateKey, password);
        bob = web3.utils.toChecksumAddress(bob);
        web3.eth.personal.unlockAccount(bob, password, 3600);
        web3.eth.sendTransaction({
            to: bob,
            from: richFather,
            value: web3.utils.toWei('1', 'ether'),
        });
    });


    describe('startInFlightExit', () => {
        function expectWithdrawData(withdrawData, outputId, exitTarget, amount, token) {
            expect(new BN(withdrawData.amount)).to.be.bignumber.equal(new BN(amount));
            expect(withdrawData.exitTarget.toUpperCase()).to.equal(exitTarget.toUpperCase());
            expect(withdrawData.outputId).to.equal(outputId);
            expect(withdrawData.token).to.equal(token);
        }

        async function setupOutputGuardHandler(
            outputGuardHandlerRegistry, outputType, isValid, exitTarget, confirmSigAddress,
        ) {
            const handler = await ExpectedOutputGuardHandler.new();
            await handler.mockIsValid(isValid);
            await handler.mockGetExitTarget(exitTarget);
            await handler.mockGetConfirmSigAddress(confirmSigAddress);
            await outputGuardHandlerRegistry.registerOutputGuardHandler(
                outputType, handler.address,
            );
            return handler;
        }

        async function registerSpendingConditionTrue(registry) {
            const condition1 = await SpendingConditionMock.new();
            await condition1.mockResult(true);
            const condition2 = await SpendingConditionMock.new();
            await condition2.mockResult(true);

            await registry.registerSpendingCondition(
                OUTPUT_TYPE_ONE, IFE_TX_TYPE, condition1.address,
            );
            await registry.registerSpendingCondition(
                OUTPUT_TYPE_TWO, IFE_TX_TYPE, condition2.address,
            );
            return { condition1, condition2 };
        }

        before(async () => {
            this.exitIdHelper = await ExitId.new();
            this.isDeposit = await IsDeposit.new(CHILD_BLOCK_INTERVAL);
            this.exitableHelper = await ExitableTimestamp.new(MIN_EXIT_PERIOD);
        });

        describe('when calling start in-flight exit succeed with valid arguments', () => {
            beforeEach(async () => {
                this.framework = await SpyPlasmaFramework.new(
                    MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
                );

                const ethVault = await SpyEthVault.new(this.framework.address);
                const erc20Vault = await SpyErc20Vault.new(this.framework.address);

                this.spendingConditionRegistry = await SpendingConditionRegistry.new();
                const { condition1, condition2 } = registerSpendingConditionTrue(this.spendingConditionRegistry);
                this.condition1 = condition1;
                this.condition2 = condition2;

                this.outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();

                this.handler1 = await setupOutputGuardHandler(
                    this.outputGuardHandlerRegistry, OUTPUT_TYPE_ONE, true, bob, bob,
                );
                this.handler2 = await setupOutputGuardHandler(
                    this.outputGuardHandlerRegistry, OUTPUT_TYPE_TWO, true, carol, carol,
                );

                this.stateTransitionVerifier = await StateTransitionVerifierMock.new();
                await this.stateTransitionVerifier.mockResult(true);

                this.exitGame = await PaymentInFlightExitRouter.new(
                    this.framework.address,
                    ethVault.address,
                    erc20Vault.address,
                    this.outputGuardHandlerRegistry.address,
                    this.spendingConditionRegistry.address,
                    this.stateTransitionVerifier.address,
                    IFE_TX_TYPE,
                );
                await this.framework.registerExitGame(IFE_TX_TYPE, this.exitGame.address, PROTOCOL.MORE_VP);

                const {
                    args,
                    argsDecoded,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [carol, alice, alice], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                this.args = args;
                this.argsDecoded = argsDecoded;

                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                this.startIFEBondSize = await this.exitGame.startIFEBondSize();
            });

            it('should call the StateTransitionVerifier with correct arguments', async () => {
                const expectedArgs = {
                    inFlightTx: this.args.inFlightTx,
                    inputTxs: this.args.inputTxs,
                    outputIndexOfInputTxs: this.args.inputUtxosPos.map(utxo => new UtxoPos(utxo).outputIndex),
                };

                // test would fail if called with unexpected arguments
                await this.stateTransitionVerifier.shouldVerifyArgumentEquals(expectedArgs);

                await this.exitGame.startInFlightExit(
                    this.args,
                    { from: alice, value: this.startIFEBondSize.toString() },
                );
            });

            it('should store in-flight exit data', async () => {
                const ethBlockTime = await time.latest();
                await this.exitGame.startInFlightExit(
                    this.args,
                    { from: alice, value: this.startIFEBondSize.toString() },
                );
                const exitId = await this.exitIdHelper.getInFlightExitId(this.args.inFlightTx);

                const exit = await this.exitGame.inFlightExits(exitId);

                expect(exit.isCanonical).to.be.true;
                expect(exit.bondOwner).to.equal(alice);
                expect(new BN(exit.bondSize)).to.be.bignumber.equal(this.startIFEBondSize);
                expect(new BN(exit.oldestCompetitorPosition)).to.be.bignumber.equal(new BN(0));
                expect(new BN(exit.exitStartTimestamp)).to.be.bignumber.closeTo(ethBlockTime, TOLERANCE_SECONDS);
                expect(new BN(exit.exitMap)).to.be.bignumber.equal(new BN(0));

                const youngestInput = this.argsDecoded.inputUtxosPos[1];
                expect(new BN(exit.position)).to.be.bignumber.equal(new BN(youngestInput));

                const input1 = await this.exitGame.getInFlightExitInput(exitId, 0);
                expectWithdrawData(
                    input1,
                    this.argsDecoded.inFlightTx.inputs[0],
                    bob,
                    this.argsDecoded.inputTxs[0].outputs[0].amount,
                    this.argsDecoded.inputTxs[0].outputs[0].token,
                );

                const input2 = await this.exitGame.getInFlightExitInput(exitId, 1);
                expectWithdrawData(
                    input2,
                    this.argsDecoded.inFlightTx.inputs[1],
                    carol,
                    this.argsDecoded.inputTxs[1].outputs[0].amount,
                    this.argsDecoded.inputTxs[1].outputs[0].token,
                );

                // outputs should be empty, they will be initialized on piggybacks
                const output = await this.exitGame.getInFlightExitOutput(exitId, 0);
                const expectedOutputId = computeNormalOutputId(this.args.inFlightTx, 0);
                expectWithdrawData(
                    output,
                    expectedOutputId,
                    constants.ZERO_ADDRESS, // exit target for outputs is not stored when starting ife
                    this.argsDecoded.inFlightTx.outputs[0].amount,
                    this.argsDecoded.inFlightTx.outputs[0].token,
                );
            });

            it('should emit InFlightExitStarted event', async () => {
                const { receipt } = await this.exitGame.startInFlightExit(
                    this.args,
                    { from: alice, value: this.startIFEBondSize.toString() },
                );

                const expectedIfeHash = web3.utils.sha3(this.args.inFlightTx);

                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    PaymentStartInFlightExit,
                    'InFlightExitStarted',
                    {
                        initiator: alice,
                        txHash: expectedIfeHash,
                    },
                );
            });

            it('should charge user with a bond', async () => {
                const preBalance = new BN(await web3.eth.getBalance(alice));
                const tx = await this.exitGame.startInFlightExit(
                    this.args,
                    { from: alice, value: this.startIFEBondSize.toString() },
                );
                const actualPostBalance = new BN(await web3.eth.getBalance(alice));
                const expectedPostBalance = preBalance
                    .sub(this.startIFEBondSize)
                    .sub(await spentOnGas(tx.receipt));

                expect(actualPostBalance).to.be.bignumber.equal(expectedPostBalance);
            });
        });

        describe('when calling start in-flight with valid arguments including a MVP tx as input', () => {
            beforeEach(async () => {
                this.framework = await SpyPlasmaFramework.new(
                    MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
                );
                const ethVault = await SpyEthVault.new(this.framework.address);
                const erc20Vault = await SpyErc20Vault.new(this.framework.address);

                this.spendingConditionRegistry = await SpendingConditionRegistry.new();
                const { condition1, condition2 } = registerSpendingConditionTrue(this.spendingConditionRegistry);
                this.condition1 = condition1;
                this.condition2 = condition2;

                this.outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();

                this.handler1 = await setupOutputGuardHandler(
                    this.outputGuardHandlerRegistry, OUTPUT_TYPE_ONE, true, bob, bob,
                );
                this.handler2 = await setupOutputGuardHandler(
                    this.outputGuardHandlerRegistry, OUTPUT_TYPE_TWO, true, carol, carol,
                );

                this.stateTransitionVerifier = await StateTransitionVerifierMock.new();
                await this.stateTransitionVerifier.mockResult(true);

                this.exitGame = await PaymentInFlightExitRouter.new(
                    this.framework.address,
                    ethVault.address,
                    erc20Vault.address,
                    this.outputGuardHandlerRegistry.address,
                    this.spendingConditionRegistry.address,
                    this.stateTransitionVerifier.address,
                    IFE_TX_TYPE,
                );
                await this.framework.registerExitGame(IFE_TX_TYPE, this.exitGame.address, PROTOCOL.MORE_VP);

                const {
                    args,
                    argsDecoded,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                this.args = args;
                this.argsDecoded = argsDecoded;
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                // override first input with MVP tx type and setup the confirm sig
                const MVP_TX_TYPE = 999;
                this.args.inputTxTypes[0] = MVP_TX_TYPE;
                this.args.inputTxsConfirmSigs[0] = sign(inputTxsBlockRoot1, bobPrivateKey);
                const dummyExitGame = await PaymentInFlightExitRouter.new(
                    this.framework.address,
                    ethVault.address,
                    erc20Vault.address,
                    this.outputGuardHandlerRegistry.address,
                    this.spendingConditionRegistry.address,
                    this.stateTransitionVerifier.address,
                    IFE_TX_TYPE,
                );
                await this.framework.registerExitGame(MVP_TX_TYPE, dummyExitGame.address, PROTOCOL.MVP);
            });

            it('should be able to run it successfully', async () => {
                const { receipt } = await this.exitGame.startInFlightExit(
                    this.args,
                    { from: alice, value: this.startIFEBondSize.toString() },
                );

                const expectedIfeHash = web3.utils.sha3(this.args.inFlightTx);

                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    PaymentStartInFlightExit,
                    'InFlightExitStarted',
                    {
                        initiator: alice,
                        txHash: expectedIfeHash,
                    },
                );
            });
        });

        describe('when in-flight exit start is called but failed', () => {
            beforeEach(async () => {
                this.framework = await SpyPlasmaFramework.new(
                    MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
                );

                this.ethVault = await SpyEthVault.new(this.framework.address);
                this.erc20Vault = await SpyErc20Vault.new(this.framework.address);

                this.spendingConditionRegistry = await SpendingConditionRegistry.new();

                // setup outputGuardHandler
                this.outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();

                this.handler1 = await setupOutputGuardHandler(
                    this.outputGuardHandlerRegistry, OUTPUT_TYPE_ONE, true, bob, bob,
                );
                this.handler2 = await setupOutputGuardHandler(
                    this.outputGuardHandlerRegistry, OUTPUT_TYPE_TWO, true, carol, carol,
                );

                this.stateTransitionVerifier = await StateTransitionVerifierMock.new();
                await this.stateTransitionVerifier.mockResult(true);

                this.exitGame = await PaymentInFlightExitRouter.new(
                    this.framework.address,
                    this.ethVault.address,
                    this.erc20Vault.address,
                    this.outputGuardHandlerRegistry.address,
                    this.spendingConditionRegistry.address,
                    this.stateTransitionVerifier.address,
                    IFE_TX_TYPE,
                );
                await this.framework.registerExitGame(IFE_TX_TYPE, this.exitGame.address, PROTOCOL.MORE_VP);
            });

            it('should fail when spending condition not registered', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'Spending condition contract not found',
                );
            });

            it('should fail when spending condition not satisfied', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                const conditionFalse = await SpendingConditionMock.new();
                await conditionFalse.mockResult(false);
                await this.spendingConditionRegistry.registerSpendingCondition(
                    OUTPUT_TYPE_ONE, IFE_TX_TYPE, conditionFalse.address,
                );

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'Spending condition failed',
                );
            });

            it('should fail when not called with a valid exit bond', async () => {
                const invalidExitBond = this.startIFEBondSize.subn(1);
                await expectRevert(
                    this.exitGame.startInFlightExit(this.args, { from: alice, value: invalidExitBond.toString() }),
                    'Input value mismatches with msg.value',
                );
            });

            it('should fail when the same in-flight exit is already started', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                await this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() });
                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'There is an active in-flight exit from this transaction',
                );
            });

            it('should fail when it failed to get the outputGuardHandler for input tx', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                const nonRegisteredOutputType = 999;
                args.inputUtxosTypes = [nonRegisteredOutputType, nonRegisteredOutputType];

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'Failed to get the outputGuardHandler of the output type',
                );
            });

            it('should fail when the output guard related info is invalid for the input tx', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                await this.handler1.mockIsValid(false);

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'Output guard information is invalid for the input tx',
                );
            });

            it('should fail when any of input transactions is not standard finalized since inclusion proof failed', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                const invalidInclusionProof = web3.utils.bytesToHex('a'.repeat(INCLUSION_PROOF_LENGTH_IN_BYTES));
                args.inputTxsInclusionProofs = [invalidInclusionProof, invalidInclusionProof];
                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'Input transaction is not standard finalized',
                );
            });

            it('should fail when any of input transactions is not standard finalized due to confirm sig mismatch for MVP tx', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                const MVP_TX_TYPE = 999;
                args.inputTxTypes[0] = MVP_TX_TYPE;
                args.inputTxsConfirmSigs[0] = web3.utils.utf8ToHex('invalid confirm sig');
                const dummyExitGame = await PaymentInFlightExitRouter.new(
                    this.framework.address,
                    this.ethVault.address,
                    this.erc20Vault.address,
                    this.outputGuardHandlerRegistry.address,
                    this.spendingConditionRegistry.address,
                    this.stateTransitionVerifier.address,
                    IFE_TX_TYPE,
                );

                // register the protocol of such tx type to be MVP
                await this.framework.registerExitGame(MVP_TX_TYPE, dummyExitGame.address, PROTOCOL.MVP);

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'Input transaction is not standard finalized',
                );
            });

            it('should fail when there are no input transactions provided', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);
                args.inputTxs = [];
                args.inputUtxosPos = [];

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'Number of input transactions does not match number of in-flight transaction inputs',
                );
            });

            it('should fail when number of input transactions does not match number of input utxos positions', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);
                args.inputUtxosPos = [];

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'Number of input transactions does not match number of provided input utxos positions.',
                );
            });

            it('should fail when number of input transactions does not match in-flight transactions number of inputs', async () => {
                const inputTx1 = createInputTransaction([DUMMY_INPUT_1], alice, AMOUNT);
                const inputTx2 = createDepositTransaction(bob, AMOUNT);

                const inputUtxosPos = [buildUtxoPos(BLOCK_NUMBER, 0, 0), buildUtxoPos(BLOCK_NUMBER, 1, 0)];
                const inFlightTx = createInFlightTx([inputTx1], inputUtxosPos, carol, AMOUNT);

                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildIfeStartArgs([inputTx1, inputTx2], [alice, alice], inputUtxosPos, inFlightTx);

                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'Number of input transactions does not match number of in-flight transaction inputs',
                );
            });

            it('should fail when number of input tx types does not match in-flight transactions number of inputs', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);
                args.inputTxTypes = [];

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'Number of input tx types does not match number of in-flight transaction inputs',
                );
            });

            it('should fail when number of output gauard preimage of input txs does not match in-flight transactions number of inputs', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);
                args.outputGuardPreimagesForInputs = [];

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'Number of output guard preimages for inputs does not match number of in-flight transaction inputs',
                );
            });

            it('should fail when number of confirm sigs of input txs does not match in-flight transactions number of inputs', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);
                args.inputTxsConfirmSigs = [];

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'Number of input transactions confirm sigs does not match number of in-flight transaction inputs',
                );
            });

            it('should fail when number of input spending condition optional args does not match in-flight transactions number of inputs', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);
                args.inputSpendingConditionOptionalArgs = [];

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'Number of input spending condition optional args does not match number of in-flight transaction inputs',
                );
            });

            it('should fail when number of witnesses does not match in-flight transactions number of inputs', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);
                args.inFlightTxWitnesses = [];

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'Number of input transactions witnesses does not match number of in-flight transaction inputs',
                );
            });

            it('should fail when number of merkle inclusion proofs does not match in-flight transactions number of inputs', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);
                args.inputTxsInclusionProofs = [];

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'Number of input transactions inclusion proofs does not match number of in-flight transaction inputs',
                );
            });

            it('should fail when number of input utxos types does not match in-flight transactions number of inputs', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);
                args.inputUtxosTypes = [];

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'Number of input utxo types does not match number of in-flight transaction inputs.',
                );
            });

            it('should fail when in-flight tx input transactions are not unique', async () => {
                const inputTx = createInputTransaction(DUMMY_INPUT_1, alice, AMOUNT);
                const inputUtxosPos = [buildUtxoPos(BLOCK_NUMBER, 0, 0), buildUtxoPos(BLOCK_NUMBER, 0, 0)];
                const inFlightTx = createInFlightTx([inputTx, inputTx], inputUtxosPos, carol, AMOUNT);

                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildIfeStartArgs([inputTx, inputTx], [alice, alice], inputUtxosPos, inFlightTx);

                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(BLOCK_NUMBER * 2, inputTxsBlockRoot2, 0);

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'In-flight transaction must have unique inputs',
                );
            });

            it('should fail when in-flight transaction is an invalid state transistion', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                await this.stateTransitionVerifier.mockResult(false);

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'Invalid state transition',
                );
            });

            it('should fail when state transition verification reverts', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                await this.stateTransitionVerifier.mockRevert();

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'Failing on purpose',
                );
            });
        });
    });
});
