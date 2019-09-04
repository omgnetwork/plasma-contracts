
const ExitableTimestamp = artifacts.require('ExitableTimestampWrapper');
const ExitId = artifacts.require('ExitId');
const ExpectedOutputGuardHandler = artifacts.require('ExpectedOutputGuardHandler');
const IsDeposit = artifacts.require('IsDepositWrapper');
const OutputGuardHandlerRegistry = artifacts.require('OutputGuardHandlerRegistry');
const PaymentInFlightExitRouter = artifacts.require('PaymentInFlightExitRouterMock');
const PaymentStartInFlightExit = artifacts.require('PaymentStartInFlightExit');
const PaymentPiggybackInFlightExit = artifacts.require('PaymentPiggybackInFlightExit');
const PaymentChallengeIFENotCanonical = artifacts.require('PaymentChallengeIFENotCanonical');
const PaymentSpendingConditionRegistry = artifacts.require('PaymentSpendingConditionRegistry');
const PaymentSpendingConditionFalse = artifacts.require('PaymentSpendingConditionFalse');
const PaymentSpendingConditionTrue = artifacts.require('PaymentSpendingConditionTrue');
const StateTransitionVerifierAccept = artifacts.require('StateTransitionVerifierAccept');
const StateTransitionVerifierReject = artifacts.require('StateTransitionVerifierReject');
const StateTransitionVerifierReverse = artifacts.require('StateTransitionVerifierReverse');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { buildUtxoPos } = require('../../../helpers/positions.js');
const { computeNormalOutputId, spentOnGas } = require('../../../helpers/utils.js');
const { PROTOCOL } = require('../../../helpers/constants.js');
const { sign } = require('../../../helpers/sign.js');
const {
    buildValidIfeStartArgs, buildIfeStartArgs, createInputTransaction, createDepositTransaction, createInFlightTx,
} = require('../../../helpers/ife.js');

contract('PaymentInFlightExitRouter', ([_, alice, richFather, carol]) => {
    const IN_FLIGHT_EXIT_BOND = 31415926535; // wei
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
    const DUMMY_INPUT_2 = '0x0000000000000000000000000000000000000000000000000000000000000002';
    const AMOUNT = 10;
    const TOLERANCE_SECONDS = new BN(1);
    const bobPrivateKey = '0x7151e5dab6f8e95b5436515b83f423c4df64fe4c6149f864daa209b26adb10ca';
    let bob;

    before('deploy and link with controller lib', async () => {
        const startInFlightExit = await PaymentStartInFlightExit.new();
        const piggybackInFlightExit = await PaymentPiggybackInFlightExit.new();
        const challengeInFlightExitNotCanonical = await PaymentChallengeIFENotCanonical.new();

        await PaymentInFlightExitRouter.link('PaymentStartInFlightExit', startInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentPiggybackInFlightExit', piggybackInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFENotCanonical', challengeInFlightExitNotCanonical.address);
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

        async function registerSpendingConditionTrue(registry) {
            const conditionTrue = await PaymentSpendingConditionTrue.new();
            await registry.registerSpendingCondition(
                OUTPUT_TYPE_ONE, IFE_TX_TYPE, conditionTrue.address,
            );
            await registry.registerSpendingCondition(
                OUTPUT_TYPE_TWO, IFE_TX_TYPE, conditionTrue.address,
            );
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

        before(async () => {
            this.exitIdHelper = await ExitId.new();
            this.isDeposit = await IsDeposit.new(CHILD_BLOCK_INTERVAL);
            this.exitableHelper = await ExitableTimestamp.new(MIN_EXIT_PERIOD);
            this.stateTransitionVerifierAccept = await StateTransitionVerifierAccept.new();
            this.conditionTrue = await PaymentSpendingConditionTrue.new();
        });

        describe('when calling start in-flight exit succeed with valid arguments', () => {
            beforeEach(async () => {
                this.framework = await SpyPlasmaFramework.new(
                    MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
                );

                this.spendingConditionRegistry = await PaymentSpendingConditionRegistry.new();
                await registerSpendingConditionTrue(this.spendingConditionRegistry);

                this.outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();

                this.handler1 = await setupOutputGuardHandler(
                    this.outputGuardHandlerRegistry, OUTPUT_TYPE_ONE, true, bob, bob,
                );
                this.handler2 = await setupOutputGuardHandler(
                    this.outputGuardHandlerRegistry, OUTPUT_TYPE_TWO, true, carol, carol,
                );

                this.exitGame = await PaymentInFlightExitRouter.new(
                    this.framework.address,
                    this.outputGuardHandlerRegistry.address,
                    this.spendingConditionRegistry.address,
                    this.stateTransitionVerifierAccept.address,
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
            });

            it('should store in-flight exit data', async () => {
                const ethBlockTime = await time.latest();
                await this.exitGame.startInFlightExit(
                    this.args,
                    { from: alice, value: IN_FLIGHT_EXIT_BOND },
                );
                const exitId = await this.exitIdHelper.getInFlightExitId(this.args.inFlightTx);

                const exit = await this.exitGame.inFlightExits(exitId);

                expect(exit.isCanonical).to.be.true;
                expect(exit.bondOwner).to.equal(alice);
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
                    { from: alice, value: IN_FLIGHT_EXIT_BOND },
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
                    { from: alice, value: IN_FLIGHT_EXIT_BOND },
                );
                const actualPostBalance = new BN(await web3.eth.getBalance(alice));
                const expectedPostBalance = preBalance
                    .sub(new BN(IN_FLIGHT_EXIT_BOND))
                    .sub(await spentOnGas(tx.receipt));

                expect(actualPostBalance).to.be.bignumber.equal(expectedPostBalance);
            });
        });

        describe('when calling start in-flight with valid arguments including a MVP tx as input', () => {
            beforeEach(async () => {
                this.framework = await SpyPlasmaFramework.new(
                    MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
                );
                this.spendingConditionRegistry = await PaymentSpendingConditionRegistry.new();
                await registerSpendingConditionTrue(this.spendingConditionRegistry);

                this.outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();

                this.handler1 = await setupOutputGuardHandler(
                    this.outputGuardHandlerRegistry, OUTPUT_TYPE_ONE, true, bob, bob,
                );
                this.handler2 = await setupOutputGuardHandler(
                    this.outputGuardHandlerRegistry, OUTPUT_TYPE_TWO, true, carol, carol,
                );

                this.exitGame = await PaymentInFlightExitRouter.new(
                    this.framework.address,
                    this.outputGuardHandlerRegistry.address,
                    this.spendingConditionRegistry.address,
                    this.stateTransitionVerifierAccept.address,
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
                    this.outputGuardHandlerRegistry.address,
                    this.spendingConditionRegistry.address,
                    this.stateTransitionVerifierAccept.address,
                    IFE_TX_TYPE,
                );
                await this.framework.registerExitGame(MVP_TX_TYPE, dummyExitGame.address, PROTOCOL.MVP);
            });

            it('should be able to run it successfully', async () => {
                const { receipt } = await this.exitGame.startInFlightExit(
                    this.args,
                    { from: alice, value: IN_FLIGHT_EXIT_BOND },
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

        describe('when in-flight exit start is called', () => {
            beforeEach(async () => {
                this.framework = await SpyPlasmaFramework.new(
                    MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
                );
                this.spendingConditionRegistry = await PaymentSpendingConditionRegistry.new();

                // setup outputGuardHandler
                this.outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();

                this.handler1 = await setupOutputGuardHandler(
                    this.outputGuardHandlerRegistry, OUTPUT_TYPE_ONE, true, bob, bob,
                );
                this.handler2 = await setupOutputGuardHandler(
                    this.outputGuardHandlerRegistry, OUTPUT_TYPE_TWO, true, carol, carol,
                );

                this.exitGame = await PaymentInFlightExitRouter.new(
                    this.framework.address,
                    this.outputGuardHandlerRegistry.address,
                    this.spendingConditionRegistry.address,
                    this.stateTransitionVerifierAccept.address,
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
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
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

                const conditionFalse = await PaymentSpendingConditionFalse.new();
                await this.spendingConditionRegistry.registerSpendingCondition(
                    OUTPUT_TYPE_ONE, IFE_TX_TYPE, conditionFalse.address,
                );

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Spending condition failed',
                );
            });

            it('should fail when not called with a valid exit bond', async () => {
                const invalidExitBond = IN_FLIGHT_EXIT_BOND - 1;
                await expectRevert(
                    this.exitGame.startInFlightExit(this.args, { from: alice, value: invalidExitBond }),
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

                await this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND });
                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'There is an active in-flight exit from this transaction',
                );
            });

            it('should fail when the same in-flight exit is already finalized', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                await this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND });

                const exitId = await this.exitIdHelper.getInFlightExitId(args.inFlightTx);
                await this.exitGame.finalizeExit(exitId);

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
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
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
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
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
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
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
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
                    this.outputGuardHandlerRegistry.address,
                    this.spendingConditionRegistry.address,
                    this.stateTransitionVerifierAccept.address,
                    IFE_TX_TYPE,
                );

                // register the protocol of such tx type to be MVP
                await this.framework.registerExitGame(MVP_TX_TYPE, dummyExitGame.address, PROTOCOL.MVP);

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
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
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
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
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
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
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
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
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
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
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
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
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Number of input transactions confirm sigs does not match number of in-flight transaction inputs',
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
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
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
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
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
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
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
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'In-flight transaction must have unique inputs',
                );
            });
        });

        describe('when in-flight exit start is called', () => {
            beforeEach(async () => {
                this.framework = await SpyPlasmaFramework.new(
                    MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
                );
            });

            it('should fail when in-flight transaction is an invalid state transistion', async () => {
                const stateTransitionVerifierReject = await StateTransitionVerifierReject.new();
                this.outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();
                this.spendingConditionRegistry = await PaymentSpendingConditionRegistry.new();
                const exitGame = await PaymentInFlightExitRouter.new(
                    this.framework.address,
                    this.outputGuardHandlerRegistry.address,
                    this.spendingConditionRegistry.address,
                    stateTransitionVerifierReject.address,
                    IFE_TX_TYPE,
                );
                await this.framework.registerExitGame(IFE_TX_TYPE, this.exitGame.address, PROTOCOL.MORE_VP);

                const inputTx1 = createInputTransaction(DUMMY_INPUT_1, alice, AMOUNT);
                const inputTx2 = createInputTransaction(DUMMY_INPUT_2, alice, AMOUNT);
                const inputUtxosPos = [buildUtxoPos(BLOCK_NUMBER, 0, 0), buildUtxoPos(2 * BLOCK_NUMBER, 0, 0)];

                const inFlightTx = createInFlightTx([inputTx1, inputTx2], inputUtxosPos, carol, AMOUNT);

                await setupOutputGuardHandler(
                    this.outputGuardHandlerRegistry, OUTPUT_TYPE_ONE, true, alice, alice,
                );
                await setupOutputGuardHandler(
                    this.outputGuardHandlerRegistry, OUTPUT_TYPE_TWO, true, alice, alice,
                );

                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildIfeStartArgs([inputTx1, inputTx2], [alice, alice], inputUtxosPos, inFlightTx);

                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(BLOCK_NUMBER * 2, inputTxsBlockRoot2, 0);

                await expectRevert(
                    exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Invalid state transition',
                );
            });

            it('should fail when state transition verification reverts', async () => {
                const stateTransitionVerifierReverse = await StateTransitionVerifierReverse.new();
                this.outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();
                this.spendingConditionRegistry = await PaymentSpendingConditionRegistry.new();
                const exitGame = await PaymentInFlightExitRouter.new(
                    this.framework.address,
                    this.outputGuardHandlerRegistry.address,
                    this.spendingConditionRegistry.address,
                    stateTransitionVerifierReverse.address,
                    IFE_TX_TYPE,
                );
                await this.framework.registerExitGame(IFE_TX_TYPE, exitGame.address, PROTOCOL.MORE_VP);

                await setupOutputGuardHandler(
                    this.outputGuardHandlerRegistry, OUTPUT_TYPE_ONE, true, bob, bob,
                );
                await setupOutputGuardHandler(
                    this.outputGuardHandlerRegistry, OUTPUT_TYPE_TWO, true, carol, carol,
                );

                const { args, inputTxsBlockRoot1, inputTxsBlockRoot2 } = buildValidIfeStartArgs(
                    AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER,
                );
                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                await expectRevert(
                    exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Failing on purpose',
                );
            });
        });
    });
});
