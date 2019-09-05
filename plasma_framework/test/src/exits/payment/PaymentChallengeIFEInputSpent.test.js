const OutputGuardHandler = artifacts.require('ExpectedOutputGuardHandler');
const OutputGuardHandlerRegistry = artifacts.require('OutputGuardHandlerRegistry');
const PaymentInFlightExitRouter = artifacts.require('PaymentInFlightExitRouterMock');
const PaymentStartInFlightExit = artifacts.require('PaymentStartInFlightExit');
const PaymentPiggybackInFlightExit = artifacts.require('PaymentPiggybackInFlightExit');
const PaymentChallengeIFENotCanonical = artifacts.require('PaymentChallengeIFENotCanonical');
const PaymentChallengeIFEInputSpent = artifacts.require('PaymentChallengeIFEInputSpent');
const PaymentSpendingConditionRegistry = artifacts.require('PaymentSpendingConditionRegistry');
const PaymentSpendingConditionFalse = artifacts.require('PaymentSpendingConditionFalse');
const PaymentSpendingConditionTrue = artifacts.require('PaymentSpendingConditionTrue');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const StateTransitionVerifierAccept = artifacts.require('StateTransitionVerifierAccept');
const ExitId = artifacts.require('ExitIdWrapper');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { buildUtxoPos } = require('../../../helpers/positions.js');
const { addressToOutputGuard, spentOnGas } = require('../../../helpers/utils.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../../../helpers/transaction.js');

contract('PaymentChallengeIFEInputSpent', ([_, alice, inputOwner, outputOwner, challenger]) => {
    const IN_FLIGHT_EXIT_BOND = 31415926535; // wei
    const PIGGYBACK_BOND = 31415926535;
    const CHILD_BLOCK_INTERVAL = 1000;
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const OUTPUT_TYPE_ONE = 1;
    const IFE_TX_TYPE = 1;
    const YOUNGEST_POSITION_BLOCK = 1000;
    const INFLIGHT_EXIT_YOUNGEST_INPUT_POSITION = buildUtxoPos(YOUNGEST_POSITION_BLOCK, 0, 0);
    const ETH = constants.ZERO_ADDRESS;
    const BLOCK_NUMBER = 5000;
    const MAX_INPUT_SIZE = 4;
    const PAYMENT_TX_TYPE = 1;

    before('deploy and link with controller lib', async () => {
        const startInFlightExit = await PaymentStartInFlightExit.new();
        const piggybackInFlightExit = await PaymentPiggybackInFlightExit.new();
        const challengeInFlightExitNotCanonical = await PaymentChallengeIFENotCanonical.new();
        const challengeIFEInputSpent = await PaymentChallengeIFEInputSpent.new();

        await PaymentInFlightExitRouter.link('PaymentStartInFlightExit', startInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentPiggybackInFlightExit', piggybackInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFENotCanonical', challengeInFlightExitNotCanonical.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFEInputSpent', challengeIFEInputSpent.address);

        this.exitIdHelper = await ExitId.new();
        this.stateTransitionVerifierAccept = await StateTransitionVerifierAccept.new();

        this.outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();
        const handler = await OutputGuardHandler.new(true, alice);
        await this.outputGuardHandlerRegistry.registerOutputGuardHandler(OUTPUT_TYPE_ONE, handler.address);
    });

    describe('challenge in-flight exit input spent', () => {
        /**
         * This sets up an IFE tx with 2 inputs, starts the IFE and piggybacks on the 2nd input.
         * It also creates a tx that spends that input, which will be used to challenge the piggyback.
         */
        const buildPiggybackInputData = async () => {
            const outputAmount = 997;
            const outputGuard = addressToOutputGuard(outputOwner);
            const output = new PaymentTransactionOutput(outputAmount, outputGuard, ETH);

            const inputOneUtxoPos = buildUtxoPos(BLOCK_NUMBER, 0, 0);
            const inputTwoUtxoPos = buildUtxoPos(BLOCK_NUMBER, 1, 0);
            const inFlightTx = new PaymentTransaction(1, [inputOneUtxoPos, inputTwoUtxoPos], [output]);
            const rlpInFlightTxBytes = web3.utils.bytesToHex(inFlightTx.rlpEncoded());

            const emptyWithdrawData = {
                outputId: web3.utils.sha3('dummy output id'),
                outputGuard: web3.utils.sha3('dummy output guard'),
                exitTarget: constants.ZERO_ADDRESS,
                token: constants.ZERO_ADDRESS,
                amount: 0,
            };

            const inFlightExitData = {
                exitStartTimestamp: (await time.latest()).toNumber(),
                exitMap: 0,
                position: INFLIGHT_EXIT_YOUNGEST_INPUT_POSITION,
                bondOwner: alice,
                oldestCompetitorPosition: 0,
                inputs: [{
                    outputId: web3.utils.sha3('dummy output id'),
                    outputGuard: web3.utils.sha3('dummy output guard'),
                    exitTarget: inputOwner,
                    token: ETH,
                    amount: 999,
                }, {
                    outputId: web3.utils.sha3('dummy output id'),
                    outputGuard: web3.utils.sha3('dummy output guard'),
                    exitTarget: inputOwner,
                    token: ETH,
                    amount: 998,
                }, emptyWithdrawData, emptyWithdrawData],
                outputs: [{
                    outputId: web3.utils.sha3('dummy output id'),
                    outputGuard: web3.utils.sha3('dummy output guard'),
                    exitTarget: outputOwner,
                    token: ETH,
                    amount: outputAmount,
                }, emptyWithdrawData, emptyWithdrawData, emptyWithdrawData],
            };

            const exitId = await this.exitIdHelper.getInFlightExitId(rlpInFlightTxBytes);

            const argsInputOne = {
                inFlightTx: rlpInFlightTxBytes,
                inputIndex: 0,
            };

            const argsInputTwo = {
                inFlightTx: rlpInFlightTxBytes,
                inputIndex: 1,
            };

            return {
                argsInputOne,
                inputOneUtxoPos,
                argsInputTwo,
                inputTwoUtxoPos,
                exitId,
                inFlightExitData,
            };
        };

        beforeEach(async () => {
            this.framework = await SpyPlasmaFramework.new(
                MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
            );
            this.spendingConditionRegistry = await PaymentSpendingConditionRegistry.new();
            this.exitGame = await PaymentInFlightExitRouter.new(
                this.framework.address,
                this.outputGuardHandlerRegistry.address,
                this.spendingConditionRegistry.address,
                this.stateTransitionVerifierAccept.address,
                IFE_TX_TYPE,
            );

            const conditionTrue = await PaymentSpendingConditionTrue.new();

            await this.spendingConditionRegistry.registerSpendingCondition(
                OUTPUT_TYPE_ONE, IFE_TX_TYPE, conditionTrue.address,
            );

            this.testData = await buildPiggybackInputData();

            // set some different timestamp than "now" to the youngest position.
            this.youngestPositionTimestamp = (await time.latest()).sub(new BN(100)).toNumber();
            await this.framework.setBlock(
                YOUNGEST_POSITION_BLOCK, web3.utils.sha3('dummy root'), this.youngestPositionTimestamp,
            );
            await this.exitGame.setInFlightExit(this.testData.exitId, this.testData.inFlightExitData);

            // Piggyback input 2
            this.piggybackTx = await this.exitGame.piggybackInFlightExitOnInput(
                this.testData.argsInputTwo, { from: inputOwner, value: PIGGYBACK_BOND },
            );

            // Create a transaction that spends the input (input 2 of piggybacked tx)
            this.spendingTx = new PaymentTransaction(
                1,
                [this.testData.inputTwoUtxoPos],
                [new PaymentTransactionOutput(0, outputOwner, ETH)],
            );
            this.inFlightTxNotPiggybackedIndex = 0;
            this.inFlightTxPiggybackedIndex = 1;

            this.challengeArgs = {
                inFlightTx: this.testData.argsInputTwo.inFlightTx,
                inFlightTxInputIndex: this.inFlightTxPiggybackedIndex,
                spendingTx: web3.utils.bytesToHex(this.spendingTx.rlpEncoded()),
                spendingTxInputIndex: 0,
                spendingTxInputOutputType: OUTPUT_TYPE_ONE,
                spendingTxWitness: addressToOutputGuard(inputOwner),
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
                // Piggyback input1 as well.
                await this.exitGame.piggybackInFlightExitOnInput(
                    this.testData.argsInputOne, { from: inputOwner, value: PIGGYBACK_BOND },
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
                this.challengeArgs.inFlightTx = this.challengeArgs.spendingTx;

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

            it('should fail when spending tx is the same as in-flight one', async () => {
                this.challengeArgs.spendingTx = this.challengeArgs.inFlightTx;
                await expectRevert(
                    this.exitGame.challengeInFlightExitInputSpent(this.challengeArgs, { from: challenger }),
                    'The spending transaction is the same as the in-flight transaction',
                );
            });

            it('should fail when the spending transaction input index is incorrect', async () => {
                this.challengeArgs.spendingTxInputIndex += 1;
                await expectRevert(
                    this.exitGame.challengeInFlightExitInputSpent(this.challengeArgs, { from: challenger }),
                    'Incorrect spending transaction input index',
                );
            });

            it('should fail when the spent input is not the same as piggybacked input', async () => {
                // create another spending tx
                const anotherInput = buildUtxoPos(BLOCK_NUMBER + 1, 3, 0);
                const anotherTx = new PaymentTransaction(
                    1,
                    [anotherInput],
                    [new PaymentTransactionOutput(0, outputOwner, ETH)],
                );
                this.challengeArgs.spendingTx = web3.utils.bytesToHex(anotherTx.rlpEncoded());
                await expectRevert(
                    this.exitGame.challengeInFlightExitInputSpent(this.challengeArgs, { from: challenger }),
                    'Spent input is not the same as piggybacked input',
                );
            });

            it('should fail when spending condition for given output is not registered', async () => {
                this.challengeArgs.spendingTxInputOutputType = OUTPUT_TYPE_ONE + 1;
                await expectRevert(
                    this.exitGame.challengeInFlightExitInputSpent(this.challengeArgs, { from: challenger }),
                    'Spending condition contract not found',
                );
            });

            it('should fail when spending condition is not met', async () => {
                const newOutputType = OUTPUT_TYPE_ONE + 1;
                const conditionFalse = await PaymentSpendingConditionFalse.new();
                await this.spendingConditionRegistry.registerSpendingCondition(
                    newOutputType, IFE_TX_TYPE, conditionFalse.address,
                );
                this.challengeArgs.spendingTxInputOutputType = newOutputType;
                await expectRevert(
                    this.exitGame.challengeInFlightExitInputSpent(this.challengeArgs, { from: challenger }),
                    'Spent input spending condition is not met',
                );
            });
        });
    });
});
