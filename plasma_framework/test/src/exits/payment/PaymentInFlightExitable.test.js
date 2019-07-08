const PaymentInFlightExitable = artifacts.require('PaymentInFlightExitableMock');
const PaymentSpendingConditionFalse = artifacts.require('PaymentSpendingConditionFalse');
const PaymentSpendingConditionTrue = artifacts.require('PaymentSpendingConditionTrue');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const DummyVault = artifacts.require('DummyVault');
const ExitId = artifacts.require('ExitIdWrapper');
const IsDeposit = artifacts.require('IsDepositWrapper');
const ExitableTimestamp = artifacts.require('ExitableTimestampWrapper');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');
const rlp = require('rlp');

const { MerkleTree } = require('../../../helpers/merkle.js');
const { buildUtxoPos, UtxoPos } = require('../../../helpers/utxoPos.js');
const {
    addressToOutputGuard, computeNormalOutputId, spentOnGas,
} = require('../../../helpers/utils.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../../../helpers/transaction.js');

contract('PaymentInFlightExitable', ([_, alice, bob, carol]) => {
    const IN_FLIGHT_EXIT_BOND = 31415926535; // wei
    const ETH = constants.ZERO_ADDRESS;
    const OTHER_TOKEN = '0x0000000000000000000000000000000000000001';
    const CHILD_BLOCK_INTERVAL = 1000;
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const OUTPUT_TYPE_ZERO = 0;
    const IFE_TX_TYPE = 1;
    const SIGNATURE_LENGTH_IN_BYTES = 65;
    const INCLUSION_PROOF_LENGTH_IN_BYTES = 512;
    const IN_FLIGHT_TX_SIGNATURE_BYTES = 'a'.repeat(SIGNATURE_LENGTH_IN_BYTES);
    const BLOCK_NUMBER = 1000;
    const DUMMY_INPUT_1 = '0x0000000000000000000000000000000000000000000000000000000000000001';
    const DUMMY_INPUT_2 = '0x0000000000000000000000000000000000000000000000000000000000000002';
    const DUMMY_INPUT_3 = '0x0000000000000000000000000000000000000000000000000000000000000003';
    const MERKLE_TREE_HEIGHT = 16;
    const AMOUNT = 10;

    describe('startInFlightExit', () => {
        function buildValidIfeStartArgs(amount, [ifeOwner, inputOwner1, inputOwner2], blockNum) {
            const inputTx1 = createInputTransaction(DUMMY_INPUT_1, inputOwner1, amount);
            const inputTx2 = createInputTransaction(DUMMY_INPUT_2, inputOwner2, amount);
            const inputTxs = [inputTx1, inputTx2];

            const inputUtxosPos = [buildUtxoPos(blockNum, 0, 0), buildUtxoPos(blockNum, 1, 0)];

            const inFlightTx = createInFlightTx(inputTxs, inputUtxosPos, ifeOwner, amount);
            const { args, inputTxsBlockRoot } = buildIfeStartArgs(inputTxs, inputUtxosPos, inFlightTx);

            return { args, inputTxs, inputTxsBlockRoot };
        }

        function buildIfeStartArgs([inputTx1, inputTx2], inputUtxosPos, inFlightTx) {
            const rlpInputTx1 = inputTx1.rlpEncoded();
            const encodedInputTx1 = web3.utils.bytesToHex(rlpInputTx1);

            const rlpInputTx2 = inputTx2.rlpEncoded();
            const encodedInputTx2 = web3.utils.bytesToHex(rlpInputTx2);

            const inputTxsRaw = web3.utils.bytesToHex(rlp.encode([rlpInputTx1, rlpInputTx2]));

            const merkleTree = new MerkleTree([encodedInputTx1, encodedInputTx2], MERKLE_TREE_HEIGHT);
            const inclusionProof1 = merkleTree.getInclusionProof(encodedInputTx1);
            const inclusionProof2 = merkleTree.getInclusionProof(encodedInputTx2);

            const inclusionProofs = inclusionProof1 + inclusionProof2.slice(2);

            const inputUtxosTypesRaw = rlp.encode([OUTPUT_TYPE_ZERO, OUTPUT_TYPE_ZERO]);

            const inFlightTxRaw = web3.utils.bytesToHex(inFlightTx.rlpEncoded());
            const inputUtxosPosRaw = web3.utils.bytesToHex(rlp.encode(inputUtxosPos));

            const inFlightTxSigs = web3.utils.bytesToHex(`${IN_FLIGHT_TX_SIGNATURE_BYTES}${IN_FLIGHT_TX_SIGNATURE_BYTES}`);

            const args = {
                inFlightTx: inFlightTxRaw,
                inputTxs: inputTxsRaw,
                inputUtxosPos: inputUtxosPosRaw,
                inputUtxosTypes: inputUtxosTypesRaw,
                inputTxsInclusionProofs: inclusionProofs,
                inFlightTxSigs,
            };

            const inputTxsBlockRoot = merkleTree.root;

            return { args, inputTxsBlockRoot };
        }

        function createInputTransaction(input, owner, amount, token = ETH) {
            const output = new PaymentTransactionOutput(amount, addressToOutputGuard(owner), token);
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

        function expectInput(input, inputTx) {
            expect(parseInt(input.amount, 10)).to.equal(inputTx.outputs[0].amount);
            expect(input.outputGuard.toUpperCase()).to.equal(inputTx.outputs[0].outputGuard.toUpperCase());
            expect(input.token).to.equal(inputTx.outputs[0].token);
        }

        function expectOutputNotSet(output) {
            // output is not set when amount equals 0
            expect(parseInt(output.amount, 10)).to.equal(0);
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
                this.exitGame = await PaymentInFlightExitable.new(this.framework.address);
                this.vault = await DummyVault.new();

                const { args, inputTxs, inputTxsBlockRoot } = buildValidIfeStartArgs(
                    AMOUNT, [alice, bob, carol], BLOCK_NUMBER,
                );
                this.args = args;
                this.inputTxs = inputTxs;
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot, 0);

                const conditionTrue = await PaymentSpendingConditionTrue.new();

                await this.exitGame.registerSpendingCondition(
                    OUTPUT_TYPE_ZERO, IFE_TX_TYPE, conditionTrue.address,
                );
            });

            it('in-flight exit data should be stored', async () => {
                const ethBlockTime = await time.latest();
                await this.exitGame.startInFlightExit(
                    this.args,
                    { from: alice, value: IN_FLIGHT_EXIT_BOND },
                );
                const exitId = await this.exitIdHelper.getInFlightExitId(this.args.inFlightTx);

                const exit = await this.exitGame.inFlightExits(exitId);
                expect(exit.bondOwner).to.equal(alice);
                expect(exit.oldestCompetitor).to.be.bignumber.equal(new BN(0));
                expect(exit.exitStartTimestamp).to.be.bignumber.equal(ethBlockTime);
                expect(exit.exitMap).to.be.bignumber.equal(new BN(0));

                const input1 = await this.exitGame.getInFlightExitInput(exitId, 0);
                expectInput(input1, this.inputTxs[0]);

                const input2 = await this.exitGame.getInFlightExitInput(exitId, 1);
                expectInput(input2, this.inputTxs[1]);

                // outputs should be empty, they will be initialized on piggybacks
                const output = await this.exitGame.getInFlightExitOutput(exitId, 0);
                expectOutputNotSet(output);
            });

            it('InFlightExitStarted event should be emitted', async () => {
                const tx = await this.exitGame.startInFlightExit(
                    this.args,
                    { from: alice, value: IN_FLIGHT_EXIT_BOND },
                );

                const expectedIfeHash = web3.utils.sha3(this.args.inFlightTx);
                expectEvent.inLogs(tx.logs, 'InFlightExitStarted', {
                    owner: alice,
                    txHash: expectedIfeHash,
                });
            });

            it('bond should be charged', async () => {
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

        describe('when spending condition for output is not registered', () => {
            beforeEach(async () => {
                this.framework = await SpyPlasmaFramework.new(
                    MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
                );
                this.exitGame = await PaymentInFlightExitable.new(this.framework.address);
                this.vault = await DummyVault.new();

                const { args, inputTxsBlockRoot } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER);
                this.args = args;
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot, 0);
            });

            it('starting in-flight exit should fail', async () => {
                await expectRevert(
                    this.exitGame.startInFlightExit(this.args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Spending condition contract not found',
                );
            });
        });

        describe('when there is a failure when verifying in-flight transaction signatures', () => {
            beforeEach(async () => {
                this.framework = await SpyPlasmaFramework.new(
                    MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
                );
                this.exitGame = await PaymentInFlightExitable.new(this.framework.address);
                this.vault = await DummyVault.new();

                const { args, inputTxsBlockRoot } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER);
                this.args = args;
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot, 0);
            });

            it('should fail because of condition not registered', async () => {
                await expectRevert(
                    this.exitGame.startInFlightExit(this.args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Spending condition contract not found',
                );
            });

            it('should fail because of spending condition not satisfied', async () => {
                const conditionFalse = await PaymentSpendingConditionFalse.new();

                await this.exitGame.registerSpendingCondition(
                    OUTPUT_TYPE_ZERO, IFE_TX_TYPE, conditionFalse.address,
                );
                await expectRevert(
                    this.exitGame.startInFlightExit(this.args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Spending condition failed',
                );
            });
        });

        describe('when in-flight exit start is called', () => {
            beforeEach(async () => {
                this.framework = await SpyPlasmaFramework.new(
                    MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
                );
                this.exitGame = await PaymentInFlightExitable.new(this.framework.address);
                this.vault = await DummyVault.new();
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
                await this.exitGame.registerSpendingCondition(
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
                await this.exitGame.registerSpendingCondition(
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
                await this.exitGame.registerSpendingCondition(
                    OUTPUT_TYPE_ZERO, IFE_TX_TYPE, conditionTrue.address,
                );
                const invalidInclusionProofs = web3.utils.bytesToHex('a'.repeat(INCLUSION_PROOF_LENGTH_IN_BYTES * 2));
                args.inputTxsInclusionProofs = invalidInclusionProofs;
                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Input transaction is not included in plasma.',
                );
            });

            it('should fail when input txs do not match inputs of in-flight tx', async () => {
                const inputTx1 = createInputTransaction(DUMMY_INPUT_1, alice, AMOUNT);
                const inputTx2 = createInputTransaction(DUMMY_INPUT_2, bob, AMOUNT);
                const inputTx3 = createInputTransaction(DUMMY_INPUT_3, alice, AMOUNT);

                const inputUtxosPos = [buildUtxoPos(BLOCK_NUMBER, 0, 0), buildUtxoPos(BLOCK_NUMBER, 1, 0)];
                const inFlightTx = createInFlightTx([inputTx1, inputTx2], inputUtxosPos, carol, AMOUNT);

                const { args, inputTxsBlockRoot } = buildIfeStartArgs([inputTx2, inputTx3], inputUtxosPos, inFlightTx);

                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot, 0);

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'In-flight transaction does not stem from input transactions',
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
                    'Number of input transactions does not match number of in-flight transaction inputs.',
                );
            });

            it('should fail when in-flight transaction overspends - single token input/output', async () => {
                const inputTx1 = createInputTransaction(DUMMY_INPUT_1, alice, AMOUNT);
                const inputTx2 = createInputTransaction(DUMMY_INPUT_2, bob, AMOUNT);

                const inputUtxosPos = [buildUtxoPos(BLOCK_NUMBER, 0, 0), buildUtxoPos(BLOCK_NUMBER, 1, 0)];
                const inFlightTx = createInFlightTx([inputTx1, inputTx2], inputUtxosPos, carol, AMOUNT * 3);

                const { args, inputTxsBlockRoot } = buildIfeStartArgs([inputTx1, inputTx2], inputUtxosPos, inFlightTx);

                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot, 0);

                const conditionTrue = await PaymentSpendingConditionTrue.new();

                await this.exitGame.registerSpendingCondition(
                    OUTPUT_TYPE_ZERO, IFE_TX_TYPE, conditionTrue.address,
                );

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Invalid in-flight transaction, spends more than provided in inputs',
                );
            });

            it('should fail when in-flight transaction overspends - multiple tokens input/output', async () => {
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

                const conditionTrue = await PaymentSpendingConditionTrue.new();
                await this.exitGame.registerSpendingCondition(
                    OUTPUT_TYPE_ZERO, IFE_TX_TYPE, conditionTrue.address,
                );

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Invalid in-flight transaction, spends more than provided in inputs',
                );
            });

            it('should fail when in-flight tx input transactions are not unique', async () => {
                const inputTx = createInputTransaction(DUMMY_INPUT_1, alice, AMOUNT);
                const inputUtxosPos = [buildUtxoPos(BLOCK_NUMBER, 0, 0), buildUtxoPos(BLOCK_NUMBER, 0, 0)];
                const inFlightTx = createInFlightTx([inputTx, inputTx], inputUtxosPos, carol, AMOUNT);

                const { args, inputTxsBlockRoot } = buildIfeStartArgs([inputTx, inputTx], inputUtxosPos, inFlightTx);

                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot, 0);

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'In-flight transaction must have unique inputs',
                );
            });
        });
    });
});
