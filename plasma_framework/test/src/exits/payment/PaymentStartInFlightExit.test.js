const ExitId = artifacts.require('ExitIdWrapper');
const ExitableTimestamp = artifacts.require('ExitableTimestampWrapper');
const IsDeposit = artifacts.require('IsDepositWrapper');
const OutputGuardHandlerRegistry = artifacts.require('OutputGuardHandlerRegistry');
const PaymentInFlightExitRouter = artifacts.require('PaymentInFlightExitRouterMock');
const PaymentStartInFlightExit = artifacts.require('PaymentStartInFlightExit');
const PaymentPiggybackInFlightExit = artifacts.require('PaymentPiggybackInFlightExit');
const PaymentChallengeIFENotCanonical = artifacts.require('PaymentChallengeIFENotCanonical');
const PaymentSpendingConditionRegistry = artifacts.require('PaymentSpendingConditionRegistry');
const PaymentSpendingConditionFalse = artifacts.require('PaymentSpendingConditionFalse');
const PaymentSpendingConditionTrue = artifacts.require('PaymentSpendingConditionTrue');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { buildUtxoPos } = require('../../../helpers/positions.js');
const { addressToOutputGuard, spentOnGas } = require('../../../helpers/utils.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../../../helpers/transaction.js');
const {
    buildValidIfeStartArgs, buildIfeStartArgs, createInputTransaction, createDepositTransaction, createInFlightTx,
    createInputsForInFlightTx,
} = require('../../../helpers/ife.js');

contract('PaymentInFlightExitRouter', ([operator, alice, bob, carol]) => {
    const IN_FLIGHT_EXIT_BOND = 31415926535; // wei
    const ETH = constants.ZERO_ADDRESS;
    const OTHER_TOKEN = '0x0000000000000000000000000000000000000001';
    const CHILD_BLOCK_INTERVAL = 1000;
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week in seconds
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const OUTPUT_TYPE_ONE = 1;
    const IFE_TX_TYPE = 1;
    const INCLUSION_PROOF_LENGTH_IN_BYTES = 512;
    const BLOCK_NUMBER = 1000;
    const DEPOSIT_BLOCK_NUMBER = BLOCK_NUMBER + 1;
    const DUMMY_INPUT_1 = '0x0000000000000000000000000000000000000000000000000000000000000001';
    const DUMMY_INPUT_2 = '0x0000000000000000000000000000000000000000000000000000000000000002';
    const AMOUNT = 10;
    const TOLERANCE_SECONDS = new BN(1);

    before('deploy and link with controller lib', async () => {
        const startInFlightExit = await PaymentStartInFlightExit.new();
        const piggybackInFlightExit = await PaymentPiggybackInFlightExit.new();
        const challengeInFlightExitNotCanonical = await PaymentChallengeIFENotCanonical.new();

        await PaymentInFlightExitRouter.link('PaymentStartInFlightExit', startInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentPiggybackInFlightExit', piggybackInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFENotCanonical', challengeInFlightExitNotCanonical.address);
    });


    describe('startInFlightExit', () => {
        function expectInput(input, inputTx) {
            expect(new BN(input.amount)).to.be.bignumber.equal(new BN(inputTx.outputs[0].amount));
            expect(addressToOutputGuard(input.exitTarget)).to.equal(inputTx.outputs[0].outputGuard);
            expect(input.token).to.equal(inputTx.outputs[0].token);
        }

        function expectOutputNotSet(output) {
            // output is not set when amount equals 0
            expect(new BN(output.amount)).to.be.bignumber.equal(new BN(0));
        }

        before(async () => {
            this.exitIdHelper = await ExitId.new();
            this.isDeposit = await IsDeposit.new(CHILD_BLOCK_INTERVAL);
            this.exitableHelper = await ExitableTimestamp.new(MIN_EXIT_PERIOD);
        });

        describe('when calling in-flight exit start with valid arguments', () => {
            beforeEach(async () => {
                this.framework = await SpyPlasmaFramework.new(
                    MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
                );
                this.spendingConditionRegistry = await PaymentSpendingConditionRegistry.new();
                const outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new(operator);

                this.exitGame = await PaymentInFlightExitRouter.new(
                    this.framework.address,
                    outputGuardHandlerRegistry.address,
                    this.spendingConditionRegistry.address,
                    IFE_TX_TYPE,
                );

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

                const conditionTrue = await PaymentSpendingConditionTrue.new();

                await this.spendingConditionRegistry.registerSpendingCondition(
                    OUTPUT_TYPE_ONE, IFE_TX_TYPE, conditionTrue.address,
                );
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
                expectInput(input1, this.argsDecoded.inputTxs[0]);

                const input2 = await this.exitGame.getInFlightExitInput(exitId, 1);
                expectInput(input2, this.argsDecoded.inputTxs[1]);

                // outputs should be empty, they will be initialized on piggybacks
                const output = await this.exitGame.getInFlightExitOutput(exitId, 0);
                expectOutputNotSet(output);
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

        describe('when in-flight exit start is called', () => {
            beforeEach(async () => {
                this.framework = await SpyPlasmaFramework.new(
                    MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
                );
                this.spendingConditionRegistry = await PaymentSpendingConditionRegistry.new();
                const outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new(operator);
                this.exitGame = await PaymentInFlightExitRouter.new(
                    this.framework.address,
                    outputGuardHandlerRegistry.address,
                    this.spendingConditionRegistry.address,
                    IFE_TX_TYPE,
                );
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
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                const conditionTrue = await PaymentSpendingConditionTrue.new();
                await this.spendingConditionRegistry.registerSpendingCondition(
                    OUTPUT_TYPE_ONE, IFE_TX_TYPE, conditionTrue.address,
                );

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
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                const conditionTrue = await PaymentSpendingConditionTrue.new();
                await this.spendingConditionRegistry.registerSpendingCondition(
                    OUTPUT_TYPE_ONE, IFE_TX_TYPE, conditionTrue.address,
                );

                await this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND });

                const exitId = await this.exitIdHelper.getInFlightExitId(args.inFlightTx);
                await this.exitGame.finalizeExit(exitId);

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'There is an active in-flight exit from this transaction',
                );
            });

            it('should fail when any of input transactions is not included in a plasma block', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                const conditionTrue = await PaymentSpendingConditionTrue.new();
                await this.spendingConditionRegistry.registerSpendingCondition(
                    OUTPUT_TYPE_ONE, IFE_TX_TYPE, conditionTrue.address,
                );
                const invalidInclusionProof = web3.utils.bytesToHex('a'.repeat(INCLUSION_PROOF_LENGTH_IN_BYTES));
                args.inputTxsInclusionProofs = [invalidInclusionProof, invalidInclusionProof];
                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Input transaction is not included in plasma',
                );
            });

            it('should fail when there are no input transactions provided', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);
                args.inputTxs = [];
                args.inputUtxosPos = [];

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Number of input transactions does not match number of in-flight transaction inputs.',
                );
            });

            it('should fail when number of input transactions does not match number of input utxos positions', async () => {
                const inputTx1 = createInputTransaction([DUMMY_INPUT_1], alice, AMOUNT);
                const inputTx2 = createDepositTransaction(bob, AMOUNT);

                const inputUtxosPos = [buildUtxoPos(BLOCK_NUMBER, 0, 0)];
                const inFlightTx = createInFlightTx([inputTx1, inputTx2], inputUtxosPos, carol, AMOUNT);

                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildIfeStartArgs([inputTx1, inputTx2], inputUtxosPos, inFlightTx);

                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

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
                } = buildIfeStartArgs([inputTx1, inputTx2], inputUtxosPos, inFlightTx);

                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Number of input transactions does not match number of in-flight transaction inputs.',
                );
            });

            it('should fail when number of witnesses does not match in-flight transactions number of inputs', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);
                args.inFlightTxWitnesses = [];

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    ' Number of input transactions witnesses does not match number of in-flight transaction inputs.',
                );
            });

            it('should fail when number of merkle inclusion proofs does not match in-flight transactions number of inputs', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);
                args.inputTxsInclusionProofs = [];

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Number of input transactions inclusion proofs does not match number of in-flight transaction inputs.',
                );
            });

            it('should fail when number of input utxos types does not match in-flight transactions number of inputs', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);
                args.inputUtxosTypes = [];

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    ' Number of input utxo types does not match number of in-flight transaction inputs.',
                );
            });

            it('should fail when in-flight transaction with single token inputs/outputs overspends', async () => {
                const inputTx1 = createInputTransaction([DUMMY_INPUT_1], alice, AMOUNT);
                const inputTx2 = createInputTransaction([DUMMY_INPUT_2], bob, AMOUNT);

                const inputUtxosPos = [buildUtxoPos(BLOCK_NUMBER, 0, 0), buildUtxoPos(BLOCK_NUMBER * 2, 0, 0)];
                const inFlightTx = createInFlightTx([inputTx1, inputTx2], inputUtxosPos, carol, AMOUNT * 3);

                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildIfeStartArgs([inputTx1, inputTx2], inputUtxosPos, inFlightTx);

                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(BLOCK_NUMBER * 2, inputTxsBlockRoot2, 0);

                const conditionTrue = await PaymentSpendingConditionTrue.new();

                await this.spendingConditionRegistry.registerSpendingCondition(
                    OUTPUT_TYPE_ONE, IFE_TX_TYPE, conditionTrue.address,
                );

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Invalid transaction, spends more than provided in inputs',
                );
            });

            it('should fail when in-flight transaction with multiple tokens inputs/outputs overspends', async () => {
                const inputTx1 = createInputTransaction([DUMMY_INPUT_1], alice, AMOUNT);
                const inputTx2 = createInputTransaction([DUMMY_INPUT_2], bob, AMOUNT, OTHER_TOKEN);

                const inputUtxosPos = [buildUtxoPos(BLOCK_NUMBER, 0, 0), buildUtxoPos(BLOCK_NUMBER * 2, 0, 0)];
                const inputs = createInputsForInFlightTx([inputTx1, inputTx2], inputUtxosPos);

                const output1 = new PaymentTransactionOutput(AMOUNT, addressToOutputGuard(carol), ETH);
                const invalidAmount = AMOUNT + 1;
                const output2 = new PaymentTransactionOutput(invalidAmount, addressToOutputGuard(carol), OTHER_TOKEN);

                const inFlightTx = new PaymentTransaction(IFE_TX_TYPE, inputs, [output1, output2]);

                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildIfeStartArgs([inputTx1, inputTx2], inputUtxosPos, inFlightTx);

                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(BLOCK_NUMBER * 2, inputTxsBlockRoot2, 0);

                const conditionTrue = await PaymentSpendingConditionTrue.new();
                await this.spendingConditionRegistry.registerSpendingCondition(
                    OUTPUT_TYPE_ONE, IFE_TX_TYPE, conditionTrue.address,
                );

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Invalid transaction, spends more than provided in inputs',
                );
            });

            it('should fail when in-flight tx input transactions are not unique', async () => {
                const inputTx = createInputTransaction([DUMMY_INPUT_1], alice, AMOUNT);
                const inputUtxosPos = [buildUtxoPos(BLOCK_NUMBER, 0, 0), buildUtxoPos(BLOCK_NUMBER, 0, 0)];
                const inFlightTx = createInFlightTx([inputTx, inputTx], inputUtxosPos, carol, AMOUNT);

                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildIfeStartArgs([inputTx, inputTx], inputUtxosPos, inFlightTx);

                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(BLOCK_NUMBER * 2, inputTxsBlockRoot2, 0);

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'In-flight transaction must have unique inputs',
                );
            });
        });
    });
});
