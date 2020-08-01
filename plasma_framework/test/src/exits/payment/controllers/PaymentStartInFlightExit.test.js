const ExitableTimestamp = artifacts.require('ExitableTimestampWrapper');
const ExitId = artifacts.require('ExitIdWrapper');
const PaymentInFlightExitRouter = artifacts.require('PaymentInFlightExitRouterMock');
const PaymentStartInFlightExit = artifacts.require('PaymentStartInFlightExit');
const PaymentPiggybackInFlightExit = artifacts.require('PaymentPiggybackInFlightExit');
const PaymentProcessInFlightExit = artifacts.require('PaymentProcessInFlightExit');
const PaymentChallengeIFENotCanonical = artifacts.require('PaymentChallengeIFENotCanonical');
const PaymentChallengeIFEInputSpent = artifacts.require('PaymentChallengeIFEInputSpent');
const PaymentChallengeIFEOutputSpent = artifacts.require('PaymentChallengeIFEOutputSpent');
const PaymentDeleteInFlightExit = artifacts.require('PaymentDeleteInFlightExit');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const SpendingConditionMock = artifacts.require('SpendingConditionMock');
const StateTransitionVerifierMock = artifacts.require('StateTransitionVerifierMock');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');

const {
    BN, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { buildUtxoPos, Position } = require('../../../../helpers/positions.js');
const { computeNormalOutputId, spentOnGas } = require('../../../../helpers/utils.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../../../../helpers/transaction.js');
const {
    PROTOCOL, VAULT_ID, DUMMY_INPUT_1, SAFE_GAS_STIPEND, ETH,
} = require('../../../../helpers/constants.js');
const {
    buildValidIfeStartArgs, buildIfeStartArgs, createInputTransaction, createDepositTransaction, createInFlightTx,
} = require('../../../../helpers/ife.js');

contract('PaymentStartInFlightExit', ([_, alice, richFather, carol]) => {
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week in seconds
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const OUTPUT_TYPE_ONE = 1;
    const OUTPUT_TYPE_TWO = 2;
    const IFE_TX_TYPE = 1;
    const INCLUSION_PROOF_LENGTH_IN_BYTES = 512;
    const BLOCK_NUMBER = 1000;
    const DEPOSIT_BLOCK_NUMBER = BLOCK_NUMBER + 1;
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
        const deleteInFlightEixt = await PaymentDeleteInFlightExit.new();
        const processInFlightExit = await PaymentProcessInFlightExit.new();

        await PaymentInFlightExitRouter.link('PaymentStartInFlightExit', startInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentPiggybackInFlightExit', piggybackInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFENotCanonical', challengeInFlightExitNotCanonical.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFEInputSpent', challengeIFEInputSpent.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFEOutputSpent', challengeIFEOutputSpent.address);
        await PaymentInFlightExitRouter.link('PaymentDeleteInFlightExit', deleteInFlightEixt.address);
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
            this.exitableHelper = await ExitableTimestamp.new(MIN_EXIT_PERIOD);
        });

        describe('when calling start in-flight exit succeed with valid arguments', () => {
            beforeEach(async () => {
                this.framework = await SpyPlasmaFramework.new(
                    MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
                );

                const ethVault = await SpyEthVault.new(this.framework.address);
                const erc20Vault = await SpyErc20Vault.new(this.framework.address);

                await this.framework.registerVault(VAULT_ID.ETH, ethVault.address);
                await this.framework.registerVault(VAULT_ID.ERC20, erc20Vault.address);

                this.spendingConditionRegistry = await SpendingConditionRegistry.new();
                const { condition1, condition2 } = registerSpendingConditionTrue(this.spendingConditionRegistry);
                this.condition1 = condition1;
                this.condition2 = condition2;

                this.stateTransitionVerifier = await StateTransitionVerifierMock.new();
                await this.stateTransitionVerifier.mockResult(true);

                const exitGameArgs = [
                    this.framework.address,
                    VAULT_ID.ETH,
                    VAULT_ID.ERC20,
                    this.spendingConditionRegistry.address,
                    this.stateTransitionVerifier.address,
                    IFE_TX_TYPE,
                    SAFE_GAS_STIPEND,
                ];
                this.exitGame = await PaymentInFlightExitRouter.new();
                await this.exitGame.boot(exitGameArgs);
                await this.framework.registerExitGame(IFE_TX_TYPE, this.exitGame.address, PROTOCOL.MORE_VP);

                const {
                    args,
                    argsDecoded,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(
                    AMOUNT,
                    [alice, bob, carol],
                    [OUTPUT_TYPE_ONE, OUTPUT_TYPE_TWO, OUTPUT_TYPE_ONE],
                    BLOCK_NUMBER,
                    DEPOSIT_BLOCK_NUMBER,
                );
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
                    outputIndexOfInputTxs: this.args.inputUtxosPos.map(utxo => new Position(utxo).outputIndex),
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

                const exits = await this.exitGame.inFlightExits([exitId]);
                const exit = exits[0];

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
                    this.argsDecoded.inFlightTx.outputs[0].outputGuard,
                    this.argsDecoded.inFlightTx.outputs[0].amount,
                    this.argsDecoded.inFlightTx.outputs[0].token,
                );
            });

            it('should emit InFlightExitStarted event', async () => {
                const { logs } = await this.exitGame.startInFlightExit(
                    this.args,
                    { from: alice, value: this.startIFEBondSize.toString() },
                );

                const expectedIfeHash = web3.utils.sha3(this.args.inFlightTx);

                await expectEvent.inLogs(
                    logs,
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

            it('should succeed when first input transaction is the youngest', async () => {
                const youngestInputTxBlockNum = BLOCK_NUMBER * 2;
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(
                    AMOUNT,
                    [alice, bob, carol],
                    [OUTPUT_TYPE_ONE, OUTPUT_TYPE_TWO, OUTPUT_TYPE_ONE],
                    youngestInputTxBlockNum,
                    BLOCK_NUMBER,
                );

                await this.framework.setBlock(youngestInputTxBlockNum, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                await this.exitGame.startInFlightExit(
                    args,
                    { from: alice, value: this.startIFEBondSize.toString() },
                );
            });

            it('should be able to start by non input or output owner', async () => {
                const { logs } = await this.exitGame.startInFlightExit(
                    this.args,
                    { from: richFather, value: this.startIFEBondSize.toString() },
                );

                const expectedIfeHash = web3.utils.sha3(this.args.inFlightTx);

                await expectEvent.inLogs(
                    logs,
                    'InFlightExitStarted',
                    {
                        initiator: richFather,
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

                await this.framework.registerVault(VAULT_ID.ETH, this.ethVault.address);
                await this.framework.registerVault(VAULT_ID.ERC20, this.erc20Vault.address);

                this.spendingConditionRegistry = await SpendingConditionRegistry.new();

                this.stateTransitionVerifier = await StateTransitionVerifierMock.new();
                await this.stateTransitionVerifier.mockResult(true);

                const exitGameArgs = [
                    this.framework.address,
                    VAULT_ID.ETH,
                    VAULT_ID.ERC20,
                    this.spendingConditionRegistry.address,
                    this.stateTransitionVerifier.address,
                    IFE_TX_TYPE,
                    SAFE_GAS_STIPEND,
                ];
                this.exitGame = await PaymentInFlightExitRouter.new();
                await this.exitGame.boot(exitGameArgs);

                await this.framework.registerExitGame(IFE_TX_TYPE, this.exitGame.address, PROTOCOL.MORE_VP);
                this.startIFEBondSize = await this.exitGame.startIFEBondSize();
            });

            it('should fail when spending condition not registered', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(
                    AMOUNT,
                    [alice, bob, carol],
                    [OUTPUT_TYPE_ONE, OUTPUT_TYPE_ONE, OUTPUT_TYPE_ONE],
                    BLOCK_NUMBER,
                    DEPOSIT_BLOCK_NUMBER,
                );
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
                } = buildValidIfeStartArgs(
                    AMOUNT,
                    [alice, bob, carol],
                    [OUTPUT_TYPE_ONE, OUTPUT_TYPE_ONE, OUTPUT_TYPE_ONE],
                    BLOCK_NUMBER,
                    DEPOSIT_BLOCK_NUMBER,
                );
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

            it('should fail when in-flight transaction is an invalid state transition', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(
                    AMOUNT,
                    [alice, bob, carol],
                    [OUTPUT_TYPE_ONE, OUTPUT_TYPE_ONE, OUTPUT_TYPE_ONE],
                    BLOCK_NUMBER,
                    DEPOSIT_BLOCK_NUMBER,
                );
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
                } = buildValidIfeStartArgs(
                    AMOUNT,
                    [alice, bob, carol],
                    [OUTPUT_TYPE_ONE, OUTPUT_TYPE_ONE, OUTPUT_TYPE_ONE],
                    BLOCK_NUMBER,
                    DEPOSIT_BLOCK_NUMBER,
                );
                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                await this.stateTransitionVerifier.mockRevert();

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'Failing on purpose',
                );
            });

            it('should fail when any of input transactions is not of MoreVP protocol', async () => {
                const nonMoreVpTxType = 999;

                // using any contract address for dummy game register
                const dummyExitGame = await ExitId.new();
                await this.framework.registerExitGame(nonMoreVpTxType, dummyExitGame.address, PROTOCOL.MVP);

                const {
                    args,
                } = buildValidIfeStartArgs(
                    AMOUNT,
                    [alice, bob, carol],
                    [OUTPUT_TYPE_ONE, OUTPUT_TYPE_ONE, OUTPUT_TYPE_ONE],
                    BLOCK_NUMBER,
                    DEPOSIT_BLOCK_NUMBER,
                );

                const output = new PaymentTransactionOutput(OUTPUT_TYPE_ONE, AMOUNT, alice, ETH);
                const nonMoreVpTx = new PaymentTransaction(nonMoreVpTxType, [], [output]);
                args.inputTxs[0] = web3.utils.bytesToHex(nonMoreVpTx.rlpEncoded());

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'MoreVpFinalization: not a MoreVP protocol tx',
                );
            });

            it('should fail when any of input transactions is not standard finalized', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(
                    AMOUNT,
                    [alice, bob, carol],
                    [OUTPUT_TYPE_ONE, OUTPUT_TYPE_ONE, OUTPUT_TYPE_ONE],
                    BLOCK_NUMBER,
                    DEPOSIT_BLOCK_NUMBER,
                );
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

            it('should fail when the same in-flight exit is already started', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(
                    AMOUNT,
                    [alice, bob, carol],
                    [OUTPUT_TYPE_ONE, OUTPUT_TYPE_ONE, OUTPUT_TYPE_ONE],
                    BLOCK_NUMBER,
                    DEPOSIT_BLOCK_NUMBER,
                );
                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                await this.exitGame.startInFlightExit(
                    args,
                    { from: alice, value: this.startIFEBondSize.toString() },
                );
                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'There is an active in-flight exit from this transaction',
                );
            });

            it('should fail when the in-flight tx is not the supported tx type', async () => {
                const inputTx1 = createInputTransaction([DUMMY_INPUT_1], OUTPUT_TYPE_ONE, alice, AMOUNT);
                const inputTx2 = createDepositTransaction(OUTPUT_TYPE_ONE, bob, AMOUNT);

                const inputUtxosPos = [buildUtxoPos(BLOCK_NUMBER, 0, 0), buildUtxoPos(BLOCK_NUMBER, 1, 0)];
                const inFlightTx = createInFlightTx([inputTx1], inputUtxosPos, OUTPUT_TYPE_ONE, carol, AMOUNT);
                const nonSupportedTxType = IFE_TX_TYPE + 1;
                inFlightTx.transactionType = nonSupportedTxType;

                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildIfeStartArgs([inputTx1, inputTx2], inputUtxosPos, inFlightTx);

                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'Unsupported transaction type of the exit game',
                );
            });

            it('should fail when there too many input transaction utxos provided', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(
                    AMOUNT,
                    [alice, bob, carol],
                    [OUTPUT_TYPE_ONE, OUTPUT_TYPE_ONE, OUTPUT_TYPE_ONE],
                    BLOCK_NUMBER,
                    DEPOSIT_BLOCK_NUMBER,
                );

                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                args.inputUtxosPos = args.inputUtxosPos.concat([0, 0, 0, 0]); // superfluous input utxo positions
                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'Too many transactions provided',
                );
            });

            it('should fail when number of input utxos does not match the number of in-flight tx inputs', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(
                    AMOUNT,
                    [alice, bob, carol],
                    [OUTPUT_TYPE_ONE, OUTPUT_TYPE_ONE, OUTPUT_TYPE_ONE],
                    BLOCK_NUMBER,
                    DEPOSIT_BLOCK_NUMBER,
                );

                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                // superfluous input utxo pos
                args.inputUtxosPos.push([0]);
                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'Number of input transactions does not match number of provided input utxos positions',
                );
            });

            it('should fail when not called with a valid exit bond', async () => {
                const invalidExitBond = this.startIFEBondSize.subn(1);
                await expectRevert(
                    this.exitGame.startInFlightExit(this.args, { from: alice, value: invalidExitBond.toString() }),
                    'Input value must match msg.value',
                );
            });

            it('should fail when there are no input transactions provided', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(
                    AMOUNT,
                    [alice, bob, carol],
                    [OUTPUT_TYPE_ONE, OUTPUT_TYPE_ONE, OUTPUT_TYPE_ONE],
                    BLOCK_NUMBER,
                    DEPOSIT_BLOCK_NUMBER,
                );
                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);
                args.inputTxs = [];
                args.inputUtxosPos = [];

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'In-flight transaction must have inputs.',
                );
            });

            it('should fail when number of input transactions does not match number of input utxos positions', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(
                    AMOUNT,
                    [alice, bob, carol],
                    [OUTPUT_TYPE_ONE, OUTPUT_TYPE_ONE, OUTPUT_TYPE_ONE],
                    BLOCK_NUMBER,
                    DEPOSIT_BLOCK_NUMBER,
                );
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);
                args.inputUtxosPos = [];

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'Number of input transactions does not match number of provided input utxos positions.',
                );
            });

            it('should fail when number of input transactions does not match in-flight transactions number of inputs', async () => {
                const inputTx1 = createInputTransaction([DUMMY_INPUT_1], OUTPUT_TYPE_ONE, alice, AMOUNT);
                const inputTx2 = createDepositTransaction(OUTPUT_TYPE_ONE, bob, AMOUNT);

                const inputUtxosPos = [buildUtxoPos(BLOCK_NUMBER, 0, 0), buildUtxoPos(BLOCK_NUMBER, 1, 0)];
                const inFlightTx = createInFlightTx([inputTx1], inputUtxosPos, OUTPUT_TYPE_ONE, carol, AMOUNT);

                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildIfeStartArgs([inputTx1, inputTx2], inputUtxosPos, inFlightTx);

                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'Number of input transactions does not match number of in-flight transaction inputs',
                );
            });

            it('should fail when number of witnesses does not match in-flight transactions number of inputs', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(
                    AMOUNT,
                    [alice, bob, carol],
                    [OUTPUT_TYPE_ONE, OUTPUT_TYPE_ONE, OUTPUT_TYPE_ONE],
                    BLOCK_NUMBER,
                    DEPOSIT_BLOCK_NUMBER,
                );
                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);
                args.inFlightTxWitnesses = [];

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'Number of input transaction witnesses does not match the number of in-flight transaction inputs',
                );
            });

            it('should fail when number of merkle inclusion proofs does not match in-flight transactions number of inputs', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(
                    AMOUNT,
                    [alice, bob, carol],
                    [OUTPUT_TYPE_ONE, OUTPUT_TYPE_ONE, OUTPUT_TYPE_ONE],
                    BLOCK_NUMBER,
                    DEPOSIT_BLOCK_NUMBER,
                );
                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);
                args.inputTxsInclusionProofs = [];

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'Number of input transactions inclusion proofs does not match the number of in-flight transaction inputs',
                );
            });

            it('should fail when in-flight tx input transactions are not unique', async () => {
                const inputTx = createInputTransaction([DUMMY_INPUT_1], OUTPUT_TYPE_ONE, alice, AMOUNT);
                const inputUtxosPos = [buildUtxoPos(BLOCK_NUMBER, 0, 0), buildUtxoPos(BLOCK_NUMBER, 0, 0)];
                const inFlightTx = createInFlightTx([inputTx, inputTx], inputUtxosPos, OUTPUT_TYPE_ONE, carol, AMOUNT);

                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildIfeStartArgs([inputTx, inputTx], inputUtxosPos, inFlightTx);

                await registerSpendingConditionTrue(this.spendingConditionRegistry);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(BLOCK_NUMBER * 2, inputTxsBlockRoot2, 0);

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: this.startIFEBondSize.toString() }),
                    'In-flight transaction must have unique inputs',
                );
            });
        });
    });
});
