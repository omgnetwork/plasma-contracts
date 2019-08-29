const OutputGuardParser = artifacts.require('DummyOutputGuardParser');
const OutputGuardParserRegistry = artifacts.require('OutputGuardParserRegistry');
const PaymentInFlightExitRouter = artifacts.require('PaymentInFlightExitRouterMock');
const PaymentStartInFlightExit = artifacts.require('PaymentStartInFlightExit');
const PaymentSpendingConditionRegistry = artifacts.require('PaymentSpendingConditionRegistry');
const PaymentSpendingConditionFalse = artifacts.require('PaymentSpendingConditionFalse');
const PaymentSpendingConditionTrue = artifacts.require('PaymentSpendingConditionTrue');
const StateTransitionVerifierAccept = artifacts.require('StateTransitionVerifierAccept');
const StateTransitionVerifierReject = artifacts.require('StateTransitionVerifierReject');
const StateTransitionVerifierReverse = artifacts.require('StateTransitionVerifierReverse');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const ExitId = artifacts.require('ExitIdWrapper');
const IsDeposit = artifacts.require('IsDepositWrapper');
const ExitableTimestamp = artifacts.require('ExitableTimestampWrapper');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { MerkleTree } = require('../../../helpers/merkle.js');
const { buildUtxoPos, UtxoPos } = require('../../../helpers/positions.js');
const {
    addressToOutputGuard, buildOutputGuard, computeNormalOutputId, spentOnGas,
} = require('../../../helpers/utils.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../../../helpers/transaction.js');

contract('PaymentInFlightExitRouter', ([_, alice, bob, carol]) => {
    const IN_FLIGHT_EXIT_BOND = 31415926535; // wei
    const ETH = constants.ZERO_ADDRESS;
    const OTHER_TOKEN = '0x0000000000000000000000000000000000000001';
    const CHILD_BLOCK_INTERVAL = 1000;
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const OUTPUT_TYPE_ZERO = 0;
    const OUTPUT_TYPE_NON_ZERO = 1;
    const IFE_TX_TYPE = 1;
    const WITNESS_LENGTH_IN_BYTES = 65;
    const INCLUSION_PROOF_LENGTH_IN_BYTES = 512;
    const IN_FLIGHT_TX_WITNESS_BYTES = web3.utils.bytesToHex('a'.repeat(WITNESS_LENGTH_IN_BYTES));
    const BLOCK_NUMBER = 1000;
    const DUMMY_INPUT_1 = '0x0000000000000000000000000000000000000000000000000000000000000001';
    const DUMMY_INPUT_2 = '0x0000000000000000000000000000000000000000000000000000000000000002';
    const MERKLE_TREE_HEIGHT = 3;
    const AMOUNT = 10;
    const TOLERANCE_SECONDS = new BN(1);

    before('deploy and link with controller lib', async () => {
        const startInFlightExit = await PaymentStartInFlightExit.new();
        await PaymentInFlightExitRouter.link('PaymentStartInFlightExit', startInFlightExit.address);
    });

    describe('startInFlightExit', () => {
        function buildValidIfeStartArgs(amount, [ifeOwner, inputOwner1, inputOwner2], blockNum) {
            const inputTx1 = createInputTransaction(DUMMY_INPUT_1, inputOwner1, amount);
            const inputTx2 = createInputTransaction(DUMMY_INPUT_2, inputOwner2, amount);
            const inputTxs = [inputTx1, inputTx2];

            const inputUtxosPos = [buildUtxoPos(blockNum, 0, 0), buildUtxoPos(blockNum, 1, 0)];

            const inFlightTx = createInFlightTx(inputTxs, inputUtxosPos, ifeOwner, amount);
            const { args, inputTxsBlockRoot } = buildIfeStartArgs(inputTxs, inputUtxosPos, inFlightTx);
            const argsDecoded = { inputTxs, inputUtxosPos, inFlightTx };

            return { args, argsDecoded, inputTxsBlockRoot };
        }

        function buildIfeStartArgs([inputTx1, inputTx2], inputUtxosPos, inFlightTx) {
            const rlpInputTx1 = inputTx1.rlpEncoded();
            const encodedInputTx1 = web3.utils.bytesToHex(rlpInputTx1);

            const rlpInputTx2 = inputTx2.rlpEncoded();
            const encodedInputTx2 = web3.utils.bytesToHex(rlpInputTx2);

            const inputTxs = [encodedInputTx1, encodedInputTx2];

            const merkleTree = new MerkleTree([encodedInputTx1, encodedInputTx2], MERKLE_TREE_HEIGHT);
            const inclusionProof1 = merkleTree.getInclusionProof(encodedInputTx1);
            const inclusionProof2 = merkleTree.getInclusionProof(encodedInputTx2);

            const inputTxsInclusionProofs = [inclusionProof1, inclusionProof2];

            const inputUtxosTypes = [OUTPUT_TYPE_ZERO, OUTPUT_TYPE_ZERO];

            const inFlightTxRaw = web3.utils.bytesToHex(inFlightTx.rlpEncoded());

            const inFlightTxWitnesses = [IN_FLIGHT_TX_WITNESS_BYTES, IN_FLIGHT_TX_WITNESS_BYTES];

            const outputGuardDataPreImage = web3.utils.toHex(alice);
            const args = {
                inFlightTx: inFlightTxRaw,
                inputTxs,
                inputUtxosPos,
                inputUtxosTypes,
                outputGuardDataPreImages: [outputGuardDataPreImage, outputGuardDataPreImage],
                inputTxsInclusionProofs,
                inFlightTxWitnesses,
            };

            const inputTxsBlockRoot = merkleTree.root;

            return { args, inputTxsBlockRoot };
        }

        function createInputTransaction(input, owner, amount, token = ETH) {
            const output = new PaymentTransactionOutput(amount, owner, token);
            return new PaymentTransaction(IFE_TX_TYPE, [input], [output]);
        }

        function createInFlightTx(inputTxs, inputUtxosPos, ifeOwner, amount, token = ETH) {
            const inputs = createInputsForInFlightTx(inputTxs, inputUtxosPos);

            const output = new PaymentTransactionOutput(
                amount * inputTxs.length,
                addressToOutputGuard(ifeOwner),
                token,
            );

            return new PaymentTransaction(1, inputs, [output]);
        }

        function createInputsForInFlightTx(inputTxs, inputUtxosPos) {
            const inputs = [];
            for (let i = 0; i < inputTxs.length; i++) {
                const inputUtxoPos = new UtxoPos(inputUtxosPos[i]);
                const inputTx = web3.utils.bytesToHex(inputTxs[i].rlpEncoded());
                const outputId = computeNormalOutputId(inputTx, inputUtxoPos.outputIndex);
                inputs.push(outputId);
            }
            return inputs;
        }

        function expectWithdrawData(withdrawData, outputId, exitTarget, amount, token) {
            expect(new BN(withdrawData.amount)).to.be.bignumber.equal(new BN(amount));
            expect(withdrawData.exitTarget.toUpperCase()).to.equal(exitTarget.toUpperCase());
            expect(withdrawData.outputId).to.equal(outputId);
            expect(withdrawData.token).to.equal(token);
        }

        before(async () => {
            this.exitIdHelper = await ExitId.new();
            this.isDeposit = await IsDeposit.new(CHILD_BLOCK_INTERVAL);
            this.exitableHelper = await ExitableTimestamp.new(MIN_EXIT_PERIOD);
            this.stateTransitionVerifierAccept = await StateTransitionVerifierAccept.new();
            this.conditionTrue = await PaymentSpendingConditionTrue.new();
        });

        describe('when calling in-flight exit start with valid arguments', () => {
            beforeEach(async () => {
                this.framework = await SpyPlasmaFramework.new(
                    MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
                );
                this.spendingConditionRegistry = await PaymentSpendingConditionRegistry.new();

                this.outputGuardParserRegistry = await OutputGuardParserRegistry.new();
                this.exitGame = await PaymentInFlightExitRouter.new(
                    this.framework.address,
                    this.spendingConditionRegistry.address,
                    this.stateTransitionVerifierAccept.address,
                    this.outputGuardParserRegistry.address,
                );
                const parser = await OutputGuardParser.new(alice);
                await this.outputGuardParserRegistry.registerOutputGuardParser(1, parser.address);

                const { args, argsDecoded, inputTxsBlockRoot } = buildValidIfeStartArgs(
                    AMOUNT, [carol, alice, alice], BLOCK_NUMBER,
                );
                this.args = args;
                this.argsDecoded = argsDecoded;
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot, 0);

                await this.spendingConditionRegistry.registerSpendingCondition(
                    OUTPUT_TYPE_ZERO, IFE_TX_TYPE, this.conditionTrue.address,
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
                    alice,
                    this.argsDecoded.inputTxs[0].outputs[0].amount,
                    this.argsDecoded.inputTxs[0].outputs[0].token,
                );

                const input2 = await this.exitGame.getInFlightExitInput(exitId, 1);
                expectWithdrawData(
                    input2,
                    this.argsDecoded.inFlightTx.inputs[1],
                    alice,
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

        describe('when in-flight exit start is called', () => {
            beforeEach(async () => {
                this.framework = await SpyPlasmaFramework.new(
                    MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
                );
                this.spendingConditionRegistry = await PaymentSpendingConditionRegistry.new();
                this.outputGuardParserRegistry = await OutputGuardParserRegistry.new();
                this.exitGame = await PaymentInFlightExitRouter.new(
                    this.framework.address,
                    this.spendingConditionRegistry.address,
                    this.stateTransitionVerifierAccept.address,
                    this.outputGuardParserRegistry.address,
                );
            });

            it('should fail when spending condition not registered', async () => {
                const { args, inputTxsBlockRoot } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot, 0);

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Spending condition contract not found',
                );
            });

            it('should fail when output guard pre-images do not match output guards', async () => {
                const { args, inputTxsBlockRoot } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot, 0);
                args.inputUtxosTypes = [OUTPUT_TYPE_NON_ZERO, OUTPUT_TYPE_NON_ZERO];

                await this.spendingConditionRegistry.registerSpendingCondition(
                    OUTPUT_TYPE_ZERO, IFE_TX_TYPE, this.conditionTrue.address,
                );

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    ' Output guard data does not match pre-image',
                );
            });

            it('should fail when spending condition not satisfied', async () => {
                const { args, inputTxsBlockRoot } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot, 0);

                const conditionFalse = await PaymentSpendingConditionFalse.new();
                await this.spendingConditionRegistry.registerSpendingCondition(
                    OUTPUT_TYPE_ZERO, IFE_TX_TYPE, conditionFalse.address,
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
                const { args, inputTxsBlockRoot } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER);

                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot, 0);

                const conditionTrue = await PaymentSpendingConditionTrue.new();
                await this.spendingConditionRegistry.registerSpendingCondition(
                    OUTPUT_TYPE_ZERO, IFE_TX_TYPE, conditionTrue.address,
                );

                await this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND });
                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'There is an active in-flight exit from this transaction',
                );
            });

            it('should fail when the same in-flight exit is already finalized', async () => {
                const { args, inputTxsBlockRoot } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER);

                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot, 0);

                const conditionTrue = await PaymentSpendingConditionTrue.new();
                await this.spendingConditionRegistry.registerSpendingCondition(
                    OUTPUT_TYPE_ZERO, IFE_TX_TYPE, conditionTrue.address,
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
                const { args, inputTxsBlockRoot } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER);

                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot, 0);

                const conditionTrue = await PaymentSpendingConditionTrue.new();
                await this.spendingConditionRegistry.registerSpendingCondition(
                    OUTPUT_TYPE_ZERO, IFE_TX_TYPE, conditionTrue.address,
                );
                const invalidInclusionProof = web3.utils.bytesToHex('a'.repeat(INCLUSION_PROOF_LENGTH_IN_BYTES));
                args.inputTxsInclusionProofs = [invalidInclusionProof, invalidInclusionProof];
                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Input transaction is not included in plasma.',
                );
            });

            it('should fail when there are no input transactions provided', async () => {
                const { args, inputTxsBlockRoot } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER);
                args.inputTxs = [];
                args.inputUtxosPos = [];

                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot, 0);

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Number of input transactions positions does not match number of in-flight transaction inputs.',
                );
            });

            it('should fail when number of input transactions does not match number of input utxos positions', async () => {
                const inputTx1 = createInputTransaction(DUMMY_INPUT_1, alice, AMOUNT);
                const inputTx2 = createInputTransaction(DUMMY_INPUT_2, bob, AMOUNT);

                const inputUtxosPos = [buildUtxoPos(BLOCK_NUMBER, 0, 0)];
                const inFlightTx = createInFlightTx([inputTx1, inputTx2], inputUtxosPos, carol, AMOUNT);

                const { args, inputTxsBlockRoot } = buildIfeStartArgs([inputTx1, inputTx2], inputUtxosPos, inFlightTx);

                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot, 0);

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Number of input transactions does not match number of provided input utxos positions.',
                );
            });

            it('should fail when number of input transactions does not match in-flight transactions number of inputs', async () => {
                const inputTx1 = createInputTransaction(DUMMY_INPUT_1, alice, AMOUNT);
                const inputTx2 = createInputTransaction(DUMMY_INPUT_2, bob, AMOUNT);

                const inputUtxosPos = [buildUtxoPos(BLOCK_NUMBER, 0, 0), buildUtxoPos(BLOCK_NUMBER, 1, 0)];
                const inFlightTx = createInFlightTx([inputTx1], inputUtxosPos, carol, AMOUNT);

                const { args, inputTxsBlockRoot } = buildIfeStartArgs([inputTx1, inputTx2], inputUtxosPos, inFlightTx);

                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot, 0);

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Number of input transactions positions does not match number of in-flight transaction inputs.',
                );
            });

            it('should fail when number of witnesses does not match in-flight transactions number of inputs', async () => {
                const { args, inputTxsBlockRoot } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER);
                args.inFlightTxWitnesses = [];

                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot, 0);

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    ' Number of input transactions witnesses does not match number of in-flight transaction inputs.',
                );
            });

            it('should fail when number of merkle inclusion proofs does not match in-flight transactions number of inputs', async () => {
                const { args, inputTxsBlockRoot } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER);
                args.inputTxsInclusionProofs = [];

                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot, 0);

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Number of input transactions inclusion proofs does not match number of in-flight transaction inputs.',
                );
            });

            it('should fail when number of input utxos types does not match in-flight transactions number of inputs', async () => {
                const { args, inputTxsBlockRoot } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER);
                args.inputUtxosTypes = [];

                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot, 0);

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    ' Number of input utxo types does not match number of in-flight transaction inputs.',
                );
            });

            it('should fail when in-flight tx input transactions are not unique', async () => {
                const inputTx = createInputTransaction(DUMMY_INPUT_1, alice, AMOUNT);
                const inputUtxosPos = [buildUtxoPos(BLOCK_NUMBER, 0, 0), buildUtxoPos(BLOCK_NUMBER, 0, 0)];
                const inFlightTx = createInFlightTx([inputTx, inputTx], inputUtxosPos, carol, AMOUNT);

                const { args, inputTxsBlockRoot } = buildIfeStartArgs([inputTx, inputTx], inputUtxosPos, inFlightTx);

                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot, 0);

                const conditionTrue = await PaymentSpendingConditionTrue.new();

                await this.spendingConditionRegistry.registerSpendingCondition(
                    OUTPUT_TYPE_ZERO, IFE_TX_TYPE, conditionTrue.address,
                );

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
                this.outputGuardParserRegistry = await OutputGuardParserRegistry.new();
                const exitGame = await PaymentInFlightExitRouter.new(
                    this.framework.address,
                    this.spendingConditionRegistry.address,
                    stateTransitionVerifierReject.address,
                    this.outputGuardParserRegistry.address,
                );
                const inputTx1 = createInputTransaction(DUMMY_INPUT_1, alice, AMOUNT);
                const inputTx2 = createInputTransaction(DUMMY_INPUT_2, bob, AMOUNT, OTHER_TOKEN);

                const inputUtxosPos = [buildUtxoPos(BLOCK_NUMBER, 0, 0), buildUtxoPos(BLOCK_NUMBER, 1, 0)];
                const inputs = createInputsForInFlightTx([inputTx1, inputTx2], inputUtxosPos);

                const output1 = new PaymentTransactionOutput(AMOUNT, addressToOutputGuard(carol), ETH);
                const invalidAmount = AMOUNT + 1;
                const output2 = new PaymentTransactionOutput(invalidAmount, addressToOutputGuard(carol), OTHER_TOKEN);

                const inFlightTx = new PaymentTransaction(IFE_TX_TYPE, inputs, [output1, output2]);

                const { args, inputTxsBlockRoot } = buildIfeStartArgs([inputTx1, inputTx2], inputUtxosPos, inFlightTx);

                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot, 0);

                await expectRevert(
                    exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Invalid state transition',
                );
            });

            it('should fail when state transition verification reverts', async () => {
                const stateTransitionVerifierReverse = await StateTransitionVerifierReverse.new();
                this.outputGuardParserRegistry = await OutputGuardParserRegistry.new();
                const exitGame = await PaymentInFlightExitRouter.new(
                    this.framework.address,
                    this.spendingConditionRegistry.address,
                    stateTransitionVerifierReverse.address,
                    this.outputGuardParserRegistry.address,
                );
                const { args, inputTxsBlockRoot } = buildValidIfeStartArgs(
                    AMOUNT, [alice, bob, carol], BLOCK_NUMBER,
                );
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot, 0);

                await expectRevert(
                    exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Failing on purpose',
                );
            });

            it('should fail when output type is not registered in output guard parser', async () => {
                this.outputGuardParserRegistry = await OutputGuardParserRegistry.new();
                const exitGame = await PaymentInFlightExitRouter.new(
                    this.framework.address,
                    this.spendingConditionRegistry.address,
                    this.stateTransitionVerifierAccept.address,
                    this.outputGuardParserRegistry.address,
                );

                await this.spendingConditionRegistry.registerSpendingCondition(
                    OUTPUT_TYPE_NON_ZERO, IFE_TX_TYPE, this.conditionTrue.address,
                );

                const inputTx1 = createInputTransaction(
                    DUMMY_INPUT_1,
                    buildOutputGuard(OUTPUT_TYPE_NON_ZERO, web3.utils.toHex(alice)),
                    AMOUNT,
                );
                const inputTx2 = createInputTransaction(
                    DUMMY_INPUT_2,
                    buildOutputGuard(OUTPUT_TYPE_NON_ZERO, web3.utils.toHex(alice)),
                    AMOUNT,
                );

                const inputUtxosPos = [buildUtxoPos(BLOCK_NUMBER, 0, 0), buildUtxoPos(BLOCK_NUMBER, 1, 0)];

                const inFlightTx = createInFlightTx([inputTx1, inputTx2], inputUtxosPos, carol, AMOUNT);

                const { args, inputTxsBlockRoot } = buildIfeStartArgs([inputTx1, inputTx2], inputUtxosPos, inFlightTx);
                args.inputUtxosTypes = [OUTPUT_TYPE_NON_ZERO, OUTPUT_TYPE_NON_ZERO];

                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot, 0);

                await expectRevert(
                    exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Failed to get the output guard parser for the output type.',
                );
            });
        });
    });
});
