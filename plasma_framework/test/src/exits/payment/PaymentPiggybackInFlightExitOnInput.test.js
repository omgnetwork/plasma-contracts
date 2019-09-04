const ExpectedOutputGuardHandler = artifacts.require('ExpectedOutputGuardHandler');
const ExitId = artifacts.require('ExitId');
const OutputGuardHandlerRegistry = artifacts.require('OutputGuardHandlerRegistry');
const PaymentChallengeIFENotCanonical = artifacts.require('PaymentChallengeIFENotCanonical');
const PaymentInFlightExitRouter = artifacts.require('PaymentInFlightExitRouterMock');
const PaymentPiggybackInFlightExit = artifacts.require('PaymentPiggybackInFlightExit');
const PaymentStartInFlightExit = artifacts.require('PaymentStartInFlightExit');
const PaymentSpendingConditionRegistry = artifacts.require('PaymentSpendingConditionRegistry');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const StateTransitionVerifierAccept = artifacts.require('StateTransitionVerifierAccept');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { calculateNormalExitable } = require('../../../helpers/exitable.js');
const { buildUtxoPos, utxoPosToTxPos } = require('../../../helpers/positions.js');
const {
    addressToOutputGuard,
} = require('../../../helpers/utils.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../../../helpers/transaction.js');

contract('PaymentInFlightExitRouter', ([_, alice, inputOwner, nonInputOwner, outputOwner]) => {
    const PIGGYBACK_BOND = 31415926535; // wei
    const ETH = constants.ZERO_ADDRESS;
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week in seconds
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const YOUNGEST_POSITION_BLOCK = 1000;
    const INFLIGHT_EXIT_YOUNGEST_INPUT_POSITION = buildUtxoPos(YOUNGEST_POSITION_BLOCK, 0, 0);
    const BLOCK_NUMBER = 5000;
    const OUTPUT_TYPE = {
        ONE: 1, TWO: 2,
    };
    const MAX_INPUT_SIZE = 4;
    const PAYMENT_TX_TYPE = 1;

    before('deploy and link with controller lib', async () => {
        const startInFlightExit = await PaymentStartInFlightExit.new();
        const piggybackInFlightExit = await PaymentPiggybackInFlightExit.new();
        const challengeInFlightExitNotCanonical = await PaymentChallengeIFENotCanonical.new();

        await PaymentInFlightExitRouter.link('PaymentStartInFlightExit', startInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentPiggybackInFlightExit', piggybackInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFENotCanonical', challengeInFlightExitNotCanonical.address);
    });

    before('deploy helper contracts', async () => {
        this.exitIdHelper = await ExitId.new();
        this.stateTransitionVerifierAccept = await StateTransitionVerifierAccept.new();
    });

    beforeEach(async () => {
        this.framework = await SpyPlasmaFramework.new(
            MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
        );

        this.outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();
        const spendingConditionRegistry = await PaymentSpendingConditionRegistry.new();

        this.exitGame = await PaymentInFlightExitRouter.new(
            this.framework.address,
            this.outputGuardHandlerRegistry.address,
            spendingConditionRegistry.address,
            this.stateTransitionVerifierAccept.address,
            PAYMENT_TX_TYPE,
        );
    });

    describe('piggybackOnInput', () => {
        /** This setup IFE data with 2 inputs with same owner and 1 output.
         *  First input uses output type 1, this uses the default outputguard handler in tests.
         *  Second input uses output type 2, so we can register custom outputguard handler for tests.
         */
        const buildPiggybackInputData = async () => {
            const outputAmount = 997;
            const outputGuard = addressToOutputGuard(outputOwner);
            const output = new PaymentTransactionOutput(outputAmount, outputGuard, ETH);

            const dummyInputUtxopos1 = buildUtxoPos(BLOCK_NUMBER, 0, 0);
            const dummyInputUtxopos2 = buildUtxoPos(BLOCK_NUMBER, 1, 0);
            const inFlightTx = new PaymentTransaction(1, [dummyInputUtxopos1, dummyInputUtxopos2], [output]);
            const rlpInFlighTxBytes = web3.utils.bytesToHex(inFlightTx.rlpEncoded());

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

            const exitId = await this.exitIdHelper.getInFlightExitId(rlpInFlighTxBytes);

            const argsInputOne = {
                inFlightTx: rlpInFlighTxBytes,
                inputIndex: 0,
            };

            const argsInputTwo = {
                inFlightTx: rlpInFlighTxBytes,
                inputIndex: 1,
            };

            return {
                argsInputOne,
                argsInputTwo,
                exitId,
                inFlightExitData,
            };
        };

        it('should fail when not send with the bond value', async () => {
            const { argsInputOne } = await buildPiggybackInputData();
            await expectRevert(
                this.exitGame.piggybackInFlightExitOnInput(argsInputOne),
                'Input value mismatches with msg.value',
            );
        });

        it('should fail when no exit to piggyback on', async () => {
            const data = await buildPiggybackInputData();
            await this.exitGame.setInFlightExit(data.exitId, data.inFlightExitData);

            const nonExistingTx = '0x';
            data.argsInputOne.inFlightTx = nonExistingTx;
            await expectRevert(
                this.exitGame.piggybackInFlightExitOnInput(
                    data.argsInputOne, { from: inputOwner, value: PIGGYBACK_BOND },
                ),
                'No in-flight exit to piggyback on',
            );
        });

        it('should fail when first phase of exit has passed', async () => {
            const data = await buildPiggybackInputData();

            await time.increase(MIN_EXIT_PERIOD / 2 + 1);
            await this.exitGame.setInFlightExit(data.exitId, data.inFlightExitData);

            await expectRevert(
                this.exitGame.piggybackInFlightExitOnInput(
                    data.argsInputOne, { from: inputOwner, value: PIGGYBACK_BOND },
                ),
                'Can only piggyback in first phase of exit period',
            );
        });

        it('should fail when input index exceed max size of tx input', async () => {
            const data = await buildPiggybackInputData();
            await this.exitGame.setInFlightExit(data.exitId, data.inFlightExitData);

            const inputIndexExceedSize = MAX_INPUT_SIZE + 1;
            data.argsInputOne.inputIndex = inputIndexExceedSize;
            await expectRevert(
                this.exitGame.piggybackInFlightExitOnInput(
                    data.argsInputOne, { from: inputOwner, value: PIGGYBACK_BOND },
                ),
                'Index exceed max size of the input',
            );
        });

        it('should fail when the same input has been piggybacked', async () => {
            const data = await buildPiggybackInputData();
            await this.exitGame.setInFlightExit(data.exitId, data.inFlightExitData);
            await this.exitGame.piggybackInFlightExitOnInput(
                data.argsInputOne, { from: inputOwner, value: PIGGYBACK_BOND },
            );

            // second attmept should fail
            await expectRevert(
                this.exitGame.piggybackInFlightExitOnInput(
                    data.argsInputOne, { from: inputOwner, value: PIGGYBACK_BOND },
                ),
                'The indexed input has been piggybacked already',
            );
        });

        it('should fail when not called by the exit target of the output', async () => {
            const data = await buildPiggybackInputData();
            await this.exitGame.setInFlightExit(data.exitId, data.inFlightExitData);
            await expectRevert(
                this.exitGame.piggybackInFlightExitOnInput(
                    data.argsInputOne, { from: nonInputOwner, value: PIGGYBACK_BOND },
                ),
                'Can be called by the exit target only',
            );
        });

        describe('When piggyback successfully', () => {
            beforeEach(async () => {
                this.testData = await buildPiggybackInputData();

                // set some different timestamp then "now" to the youngest position.
                this.youngestPositionTimestamp = (await time.latest()).sub(new BN(100)).toNumber();
                await this.framework.setBlock(
                    YOUNGEST_POSITION_BLOCK, web3.utils.sha3('dummy root'), this.youngestPositionTimestamp,
                );
                await this.exitGame.setInFlightExit(this.testData.exitId, this.testData.inFlightExitData);

                this.piggybackTx = await this.exitGame.piggybackInFlightExitOnInput(
                    this.testData.argsInputOne, { from: inputOwner, value: PIGGYBACK_BOND },
                );
            });

            it('should enqueue with correct data when it is the first piggyback of the exit on the token', async () => {
                const exitableAt = calculateNormalExitable(
                    MIN_EXIT_PERIOD, (await time.latest()).toNumber(), this.youngestPositionTimestamp,
                );

                await expectEvent.inTransaction(
                    this.piggybackTx.receipt.transactionHash,
                    SpyPlasmaFramework,
                    'EnqueueTriggered',
                    {
                        token: ETH,
                        exitableAt: new BN(exitableAt),
                        txPos: new BN(utxoPosToTxPos(INFLIGHT_EXIT_YOUNGEST_INPUT_POSITION)),
                        exitProcessor: this.exitGame.address,
                        exitId: this.testData.exitId,
                    },
                );
            });

            it('should not enqueue when it is not first piggyback of the exit on the same token', async () => {
                const expectedOutputGuardHandler = await ExpectedOutputGuardHandler.new(true, inputOwner);
                await this.outputGuardHandlerRegistry.registerOutputGuardHandler(
                    OUTPUT_TYPE.TWO, expectedOutputGuardHandler.address,
                );

                const enqueuedCountBeforePiggyback = (await this.framework.enqueuedCount()).toNumber();
                await this.exitGame.piggybackInFlightExitOnInput(
                    this.testData.argsInputTwo, { from: inputOwner, value: PIGGYBACK_BOND },
                );
                expect((await this.framework.enqueuedCount()).toNumber()).to.equal(enqueuedCountBeforePiggyback);
            });

            it('should set the exit as piggybacked on the input index', async () => {
                const exit = await this.exitGame.inFlightExits(this.testData.exitId);

                // input index = 0 --> flag the right most position to 1 on exit map thus equals 1
                expect(new BN(exit.exitMap)).to.be.bignumber.equal(new BN(1));
            });

            it('should emit InFlightExitInputPiggybacked event', async () => {
                await expectEvent.inTransaction(
                    this.piggybackTx.receipt.transactionHash,
                    PaymentPiggybackInFlightExit,
                    'InFlightExitInputPiggybacked',
                    {
                        exitTarget: inputOwner,
                        txHash: web3.utils.sha3(this.testData.argsInputOne.inFlightTx),
                        inputIndex: new BN(this.testData.argsInputOne.index),
                    },
                );
            });
        });
    });
});
