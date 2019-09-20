const OutputGuardHandler = artifacts.require('ExpectedOutputGuardHandler');
const OutputGuardHandlerRegistry = artifacts.require('OutputGuardHandlerRegistry');
const PaymentInFlightExitRouter = artifacts.require('PaymentInFlightExitRouterMock');
const PaymentStartInFlightExit = artifacts.require('PaymentStartInFlightExit');
const PaymentPiggybackInFlightExit = artifacts.require('PaymentPiggybackInFlightExit');
const PaymentProcessInFlightExit = artifacts.require('PaymentProcessInFlightExit');
const PaymentChallengeIFENotCanonical = artifacts.require('PaymentChallengeIFENotCanonical');
const PaymentChallengeIFEInputSpent = artifacts.require('PaymentChallengeIFEInputSpent');
const PaymentChallengeIFEOutputSpent = artifacts.require('PaymentChallengeIFEOutputSpent');
const SpendingConditionMock = artifacts.require('SpendingConditionMock');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const StateTransitionVerifierMock = artifacts.require('StateTransitionVerifierMock');
const ExitId = artifacts.require('ExitIdWrapper');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');
const {
    TX_TYPE, OUTPUT_TYPE, EMPTY_BYTES, EMPTY_BYTES_32, CHILD_BLOCK_INTERVAL,
} = require('../../../helpers/constants.js');
const { buildUtxoPos } = require('../../../helpers/positions.js');
const { createInputTransaction, createInFlightTx } = require('../../../helpers/ife.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../../../helpers/transaction.js');
const { spentOnGas, computeNormalOutputId, getOutputId } = require('../../../helpers/utils.js');

contract('PaymentChallengeIFEInputSpent', ([_, alice, inputOwner, outputOwner, challenger]) => {
    const DUMMY_IFE_BOND_SIZE = 31415926535;
    const PIGGYBACK_BOND = 31415926535;
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const ETH = constants.ZERO_ADDRESS;
    const INPUT_TX_AMOUNT = 123456;
    const BLOCK_NUMBER = 5000;

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

    before('deploy helper contracts', async () => {
        this.exitIdHelper = await ExitId.new();
        this.stateTransitionVerifier = await StateTransitionVerifierMock.new();
        await this.stateTransitionVerifier.mockResult(true);
    });

    describe('challenge in-flight exit input spent', () => {
        // This is the transaction whose output is the input piggyback in the IFE.
        function buildInputTx() {
            const tx = createInputTransaction(
                [
                    buildUtxoPos(BLOCK_NUMBER - CHILD_BLOCK_INTERVAL, 4, 3),
                    buildUtxoPos(BLOCK_NUMBER - CHILD_BLOCK_INTERVAL, 10, 2),
                ],
                inputOwner,
                INPUT_TX_AMOUNT,
            );

            const txBytes = web3.utils.bytesToHex(tx.rlpEncoded());
            const outputIndex = 0;

            return {
                tx,
                txBytes,
                outputIndex,
                utxoPos: buildUtxoPos(BLOCK_NUMBER, 5, outputIndex),
            };
        }

        // Sets up an IFE tx using inputTx as an input, starts the IFE and piggybacks on the input.
        const buildPiggybackInputData = async (inputTx) => {
            const outputAmount = 997;

            const firstInput = createInputTransaction([buildUtxoPos(BLOCK_NUMBER, 3, 0)], outputOwner, 334455);
            const firstInputUtxoPos = buildUtxoPos(BLOCK_NUMBER, 66, 0);

            const inFlightTx = createInFlightTx(
                [firstInput, inputTx.tx],
                [firstInputUtxoPos, inputTx.utxoPos],
                alice,
                outputAmount,
            );
            const rlpInFlightTxBytes = web3.utils.bytesToHex(inFlightTx.rlpEncoded());

            const emptyWithdrawData = {
                outputId: web3.utils.sha3('dummy output id'),
                outputGuard: web3.utils.sha3('dummy output guard'),
                exitTarget: constants.ZERO_ADDRESS,
                token: constants.ZERO_ADDRESS,
                amount: 0,
                piggybackBondSize: 0,
            };

            const inFlightExitData = {
                exitStartTimestamp: (await time.latest()).toNumber(),
                exitMap: 0,
                position: buildUtxoPos(BLOCK_NUMBER, 0, 0),
                bondOwner: alice,
                bondSize: DUMMY_IFE_BOND_SIZE,
                oldestCompetitorPosition: 0,
                inputs: [{
                    outputId: web3.utils.sha3('dummy output id'),
                    outputGuard: web3.utils.sha3('dummy output guard'),
                    exitTarget: inputOwner,
                    token: ETH,
                    amount: 999,
                    piggybackBondSize: PIGGYBACK_BOND,
                }, {
                    outputId: getOutputId(inputTx.txBytes, inputTx.utxoPos),
                    outputGuard: web3.utils.sha3('dummy output guard'),
                    exitTarget: inputOwner,
                    token: ETH,
                    amount: INPUT_TX_AMOUNT,
                    piggybackBondSize: PIGGYBACK_BOND,
                }, emptyWithdrawData, emptyWithdrawData],
                outputs: [{
                    outputId: web3.utils.sha3('dummy output id'),
                    outputGuard: web3.utils.sha3('dummy output guard'),
                    exitTarget: outputOwner,
                    token: ETH,
                    amount: outputAmount,
                    piggybackBondSize: PIGGYBACK_BOND,
                }, emptyWithdrawData, emptyWithdrawData, emptyWithdrawData],
            };

            const exitId = await this.exitIdHelper.getInFlightExitId(rlpInFlightTxBytes);

            return {
                inFlightTx: rlpInFlightTxBytes,
                exitId,
                inFlightExitData,
            };
        };

        beforeEach(async () => {
            this.framework = await SpyPlasmaFramework.new(
                MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
            );

            const ethVault = await SpyEthVault.new(this.framework.address);
            const erc20Vault = await SpyErc20Vault.new(this.framework.address);

            this.outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();
            const expectedOutputGuardHandler = await OutputGuardHandler.new();
            await expectedOutputGuardHandler.mockIsValid(true);
            await expectedOutputGuardHandler.mockGetExitTarget(alice);
            await this.outputGuardHandlerRegistry.registerOutputGuardHandler(
                OUTPUT_TYPE.PAYMENT, expectedOutputGuardHandler.address,
            );

            this.spendingConditionRegistry = await SpendingConditionRegistry.new();
            this.spendingCondition = await SpendingConditionMock.new();
            // lets the spending condition pass by default
            await this.spendingCondition.mockResult(true);
            await this.spendingConditionRegistry.registerSpendingCondition(
                OUTPUT_TYPE.PAYMENT, TX_TYPE.PAYMENT, this.spendingCondition.address,
            );

            this.exitGame = await PaymentInFlightExitRouter.new(
                this.framework.address,
                ethVault.address,
                erc20Vault.address,
                this.outputGuardHandlerRegistry.address,
                this.spendingConditionRegistry.address,
                this.stateTransitionVerifier.address,
                TX_TYPE.PAYMENT,
            );

            // Create the input tx
            const inputTx = buildInputTx();

            await this.framework.setBlock(BLOCK_NUMBER, web3.utils.sha3('dummy root'), 0);

            this.piggybackBondSize = await this.exitGame.piggybackBondSize();

            // Set up the piggyback data
            this.testData = await buildPiggybackInputData(inputTx);
            await this.exitGame.setInFlightExit(this.testData.exitId, this.testData.inFlightExitData);

            // Piggyback the second input
            await this.exitGame.setInFlightExitInputPiggybacked(
                this.testData.exitId,
                1,
                { from: inputOwner, value: this.piggybackBondSize.toString() },
            );

            // Create a transaction that spends the same input
            const challengingTx = createInputTransaction(
                [inputTx.utxoPos],
                outputOwner,
                789,
            );

            this.inFlightTxNotPiggybackedIndex = 0;
            this.inFlightTxPiggybackedIndex = 1;

            this.challengeArgs = {
                inFlightTx: this.testData.inFlightTx,
                inFlightTxInputIndex: this.inFlightTxPiggybackedIndex,
                challengingTx: web3.utils.bytesToHex(challengingTx.rlpEncoded()),
                challengingTxInputIndex: 0,
                challengingTxInputOutputType: OUTPUT_TYPE.PAYMENT,
                challengingTxInputOutputGuardPreimage: web3.utils.bytesToHex('preimage'),
                challengingTxWitness: web3.utils.utf8ToHex('dummy witness'),
                inputTx: inputTx.txBytes,
                inputUtxoPos: inputTx.utxoPos,
                spendingConditionOptionalArgs: EMPTY_BYTES,
            };
        });

        describe('after successfully challenged IFE input spent', () => {
            beforeEach(async () => {
                this.challengerPreBalance = new BN(await web3.eth.getBalance(challenger));
                const { receipt } = await this.exitGame.challengeInFlightExitInputSpent(
                    this.challengeArgs, { from: challenger },
                );
                this.challengeTxReceipt = receipt;
            });

            it('should emit InFlightExitInputBlocked event', async () => {
                await expectEvent.inTransaction(
                    this.challengeTxReceipt.transactionHash,
                    PaymentChallengeIFEInputSpent,
                    'InFlightExitInputBlocked',
                    {
                        challenger,
                        txHash: web3.utils.sha3(this.challengeArgs.inFlightTx),
                        inputIndex: new BN(this.challengeArgs.inFlightTxInputIndex),
                    },
                );
            });

            it('should remove the input from piggybacked', async () => {
                const exit = await this.exitGame.inFlightExits(this.testData.exitId);
                expect(new BN(exit.exitMap)).to.be.bignumber.equal(new BN(0));
            });

            it('should pay the piggyback bond to the challenger', async () => {
                const actualPostBalance = new BN(await web3.eth.getBalance(challenger));
                const expectedPostBalance = this.challengerPreBalance
                    .add(new BN(PIGGYBACK_BOND))
                    .sub(await spentOnGas(this.challengeTxReceipt));

                expect(actualPostBalance).to.be.bignumber.equal(expectedPostBalance);
            });
        });

        describe('check exitMap before and after challenge', () => {
            beforeEach(async () => {
                // Piggyback input0 as well.
                await this.exitGame.setInFlightExitInputPiggybacked(
                    this.testData.exitId,
                    0,
                    { from: inputOwner, value: this.piggybackBondSize.toString() },
                );
            });

            it('should remove the input from piggybacked', async () => {
                // Before the challenge, both inputs should be in the exitMap
                let exit = await this.exitGame.inFlightExits(this.testData.exitId);
                expect(new BN(exit.exitMap)).to.be.bignumber.equal(new BN(0b11));

                await this.exitGame.challengeInFlightExitInputSpent(
                    this.challengeArgs, { from: challenger },
                );

                // After the challenge, only input 1 should be in the exitMap
                exit = await this.exitGame.inFlightExits(this.testData.exitId);
                expect(new BN(exit.exitMap)).to.be.bignumber.equal(new BN(0b01));
            });
        });

        describe('failures', () => {
            it('should fail when ife not started', async () => {
                this.challengeArgs.inFlightTx = this.challengeArgs.challengingTx;

                await expectRevert(
                    this.exitGame.challengeInFlightExitInputSpent(this.challengeArgs, { from: challenger }),
                    "In-flight exit doesn't exist",
                );
            });

            it('should fail when the indexed input has not been piggybacked', async () => {
                this.challengeArgs.inFlightTxInputIndex = this.inFlightTxNotPiggybackedIndex;
                await expectRevert(
                    this.exitGame.challengeInFlightExitInputSpent(this.challengeArgs, { from: challenger }),
                    'The indexed input has not been piggybacked',
                );
            });

            it('should fail when challenging tx is the same as in-flight one', async () => {
                this.challengeArgs.challengingTx = this.challengeArgs.inFlightTx;
                await expectRevert(
                    this.exitGame.challengeInFlightExitInputSpent(this.challengeArgs, { from: challenger }),
                    'The challenging transaction is the same as the in-flight transaction',
                );
            });

            it('should fail when the challenging transaction input index is incorrect', async () => {
                this.challengeArgs.challengingTxInputIndex += 1;
                // The spending condition will fail if the challengingTxInputIndex does not point to
                // the correct inputTx output
                await this.spendingCondition.mockResult(false);
                await expectRevert(
                    this.exitGame.challengeInFlightExitInputSpent(this.challengeArgs, { from: challenger }),
                    'Spending condition failed',
                );
            });

            it('should fail when the spent input is not the same as piggybacked input', async () => {
                // create a different input tx
                const anotherTx = createInputTransaction([buildUtxoPos(BLOCK_NUMBER, 3, 0)], outputOwner, 123);
                this.challengeArgs.inputTx = web3.utils.bytesToHex(anotherTx.rlpEncoded());
                this.challengeArgs.inputUtxoPos = buildUtxoPos(BLOCK_NUMBER, 50, 0);
                await expectRevert(
                    this.exitGame.challengeInFlightExitInputSpent(this.challengeArgs, { from: challenger }),
                    'Spent input is not the same as piggybacked input',
                );
            });

            it('should fail when provided output type does not match exiting output', async () => {
                this.challengeArgs.challengingTxInputOutputType = 2;
                const expectedOutputGuardHandler = await OutputGuardHandler.new();
                await expectedOutputGuardHandler.mockIsValid(false);
                await this.outputGuardHandlerRegistry.registerOutputGuardHandler(
                    this.challengeArgs.challengingTxInputOutputType, expectedOutputGuardHandler.address,
                );
                await expectRevert(
                    this.exitGame.challengeInFlightExitInputSpent(this.challengeArgs, { from: challenger }),
                    'Some of the output guard related information is not valid',
                );
            });

            it('should fail when spending condition for given output is not registered', async () => {
                const outputId = computeNormalOutputId(this.challengeArgs.inputTx, 0);
                const challengingTxOutput = new PaymentTransactionOutput(123, alice, ETH);
                const challengingTx = new PaymentTransaction(23, [outputId], [challengingTxOutput]);

                this.challengeArgs.challengingTx = web3.utils.bytesToHex(challengingTx.rlpEncoded());
                await expectRevert(
                    this.exitGame.challengeInFlightExitInputSpent(this.challengeArgs, { from: challenger }),
                    'Spending condition contract not found',
                );
            });

            it('should fail when spending condition is not met', async () => {
                await this.spendingCondition.mockResult(false);
                await expectRevert(
                    this.exitGame.challengeInFlightExitInputSpent(this.challengeArgs, { from: challenger }),
                    'Spending condition failed',
                );
            });
        });
    });
});
