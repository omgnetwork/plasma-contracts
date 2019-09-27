const ExpectedOutputGuardHandler = artifacts.require('ExpectedOutputGuardHandler');
const ExitIdWrapper = artifacts.require('ExitIdWrapper');
const OutputGuardHandlerRegistry = artifacts.require('OutputGuardHandlerRegistry');
const PaymentChallengeIFENotCanonical = artifacts.require('PaymentChallengeIFENotCanonical');
const PaymentChallengeIFEInputSpent = artifacts.require('PaymentChallengeIFEInputSpent');
const PaymentChallengeIFEOutputSpent = artifacts.require('PaymentChallengeIFEOutputSpent');
const PaymentInFlightExitRouter = artifacts.require('PaymentInFlightExitRouterMock');
const PaymentPiggybackInFlightExit = artifacts.require('PaymentPiggybackInFlightExit');
const PaymentStartInFlightExit = artifacts.require('PaymentStartInFlightExit');
const PaymentProcessInFlightExit = artifacts.require('PaymentProcessInFlightExit');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const StateTransitionVerifierMock = artifacts.require('StateTransitionVerifierMock');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { calculateNormalExitable } = require('../../../helpers/exitable.js');
const { buildUtxoPos, utxoPosToTxPos } = require('../../../helpers/positions.js');
const { buildOutputGuard } = require('../../../helpers/utils.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../../../helpers/transaction.js');

contract('PaymentInFlightExitRouter', ([_, alice, inputOwner, outputOwner, nonOutputOwner]) => {
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
    const DUMMY_OUTPUT_GUARD_PREIMAGE = web3.utils.toHex('dummy pre-image of output guard');
    const MAX_INPUT_SIZE = 4;
    const MAX_OUTPUT_SIZE = 4;
    const PAYMENT_TX_TYPE = 1;

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
        this.exitIdHelper = await ExitIdWrapper.new();
        this.stateTransitionVerifier = await StateTransitionVerifierMock.new();
        await this.stateTransitionVerifier.mockResult(true);
    });

    beforeEach(async () => {
        this.framework = await SpyPlasmaFramework.new(
            MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
        );

        const ethVault = await SpyEthVault.new(this.framework.address);
        const erc20Vault = await SpyErc20Vault.new(this.framework.address);

        this.outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();
        const spendingConditionRegistry = await SpendingConditionRegistry.new();

        this.exitGame = await PaymentInFlightExitRouter.new(
            this.framework.address,
            ethVault.address,
            erc20Vault.address,
            this.outputGuardHandlerRegistry.address,
            spendingConditionRegistry.address,
            this.stateTransitionVerifier.address,
            PAYMENT_TX_TYPE,
        );
        this.startIFEBondSize = await this.exitGame.startIFEBondSize();
        this.piggybackBondSize = await this.exitGame.piggybackBondSize();
    });

    describe('piggybackOnOutput', () => {
        beforeEach(async () => {
            // returns true when "isValid" is called and return the outputOwner when "exitTarget" is called
            // only set the output type 1 case. Leave output 2 case to stub more complex test cases.
            const expectedOutputGuardHandler = await ExpectedOutputGuardHandler.new();
            await expectedOutputGuardHandler.mockIsValid(true);
            await expectedOutputGuardHandler.mockGetExitTarget(outputOwner);
            await this.outputGuardHandlerRegistry.registerOutputGuardHandler(
                OUTPUT_TYPE.ONE, expectedOutputGuardHandler.address,
            );
        });

        /**
         * This setup IFE data with 1 input and 2 outputs with same owner.
         * First output is of output having the address in output guard. (mimic payment)
         * Secode output uses the outputguard mechanism to hide output type and output guard preimage. (mimic DEX)
         * */
        const buildPiggybackOutputData = async () => {
            const outputAmount1 = 499;
            const outputGuard1 = outputOwner;
            const output1 = new PaymentTransactionOutput(outputAmount1, outputGuard1, ETH);

            const outputAmount2 = 498;
            const outputGuard2 = buildOutputGuard(OUTPUT_TYPE.TWO, DUMMY_OUTPUT_GUARD_PREIMAGE);
            const output2 = new PaymentTransactionOutput(outputAmount2, outputGuard2, ETH);

            const inFlightTx = new PaymentTransaction(1, [buildUtxoPos(BLOCK_NUMBER, 0, 0)], [output1, output2]);
            const rlpInFlighTxBytes = web3.utils.bytesToHex(inFlightTx.rlpEncoded());

            const emptyWithdrawData = {
                outputId: web3.utils.sha3('dummy output id'),
                exitTarget: constants.ZERO_ADDRESS,
                token: constants.ZERO_ADDRESS,
                amount: 0,
                piggybackBondSize: 0,
            };

            const inFlightExitData = {
                exitStartTimestamp: (await time.latest()).toNumber(),
                exitMap: 0,
                position: INFLIGHT_EXIT_YOUNGEST_INPUT_POSITION,
                bondOwner: alice,
                oldestCompetitorPosition: 0,
                inputs: [{
                    outputId: web3.utils.sha3('dummy output id'),
                    exitTarget: inputOwner,
                    token: ETH,
                    amount: 999,
                    piggybackBondSize: 0,
                }, emptyWithdrawData, emptyWithdrawData, emptyWithdrawData],
                outputs: [{
                    outputId: web3.utils.sha3('dummy output id'),
                    exitTarget: constants.ZERO_ADDRESS, // would not be set during start IFE
                    token: ETH,
                    amount: outputAmount1,
                    piggybackBondSize: 0,
                }, {
                    outputId: web3.utils.sha3('dummy output id'),
                    exitTarget: constants.ZERO_ADDRESS, // would not be set during start IFE
                    token: ETH,
                    amount: outputAmount2,
                    piggybackBondSize: 0,
                }, emptyWithdrawData, emptyWithdrawData],
                bondSize: this.startIFEBondSize.toString(),
            };

            const exitId = await this.exitIdHelper.getInFlightExitId(rlpInFlighTxBytes);

            const argsForOutputOne = {
                inFlightTx: rlpInFlighTxBytes,
                outputIndex: 0,
                outputType: OUTPUT_TYPE.ONE,
                outputGuardPreimage: '0x',
            };

            const argsForOutputTwo = {
                inFlightTx: rlpInFlighTxBytes,
                outputIndex: 1,
                outputType: OUTPUT_TYPE.TWO,
                outputGuardPreimage: DUMMY_OUTPUT_GUARD_PREIMAGE,
            };

            return {
                outputOneCase: {
                    args: argsForOutputOne,
                    amount: outputAmount1,
                    outputGuard: outputGuard1,
                },
                outputTwoCase: {
                    args: argsForOutputTwo,
                    amount: outputAmount2,
                    outputGuard: outputGuard2,
                },
                exitId,
                inFlightExitData,
            };
        };

        it('should fail when not send with the bond value', async () => {
            const data = await buildPiggybackOutputData();
            await expectRevert(
                this.exitGame.piggybackInFlightExitOnOutput(data.outputOneCase.args),
                'Input value mismatches with msg.value',
            );
        });

        it('should fail when no exit to piggyback on', async () => {
            const data = await buildPiggybackOutputData();
            await expectRevert(
                this.exitGame.piggybackInFlightExitOnOutput(
                    data.outputOneCase.args, { from: outputOwner, value: this.piggybackBondSize.toString() },
                ),
                'No in-flight exit to piggyback on',
            );
        });

        it('should fail when first phase of exit has passed', async () => {
            const data = await buildPiggybackOutputData();

            await time.increase(MIN_EXIT_PERIOD / 2 + 1);
            await this.exitGame.setInFlightExit(data.exitId, data.inFlightExitData);

            await expectRevert(
                this.exitGame.piggybackInFlightExitOnOutput(
                    data.outputOneCase.args, { from: outputOwner, value: this.piggybackBondSize.toString() },
                ),
                'Can only piggyback in first phase of exit period',
            );
        });

        it('should fail when output index exceed max size of tx output', async () => {
            const data = await buildPiggybackOutputData();

            await this.exitGame.setInFlightExit(data.exitId, data.inFlightExitData);

            data.outputOneCase.args.outputIndex = MAX_OUTPUT_SIZE + 1;
            await expectRevert(
                this.exitGame.piggybackInFlightExitOnOutput(
                    data.outputOneCase.args, { from: outputOwner, value: this.piggybackBondSize.toString() },
                ),
                'Index exceed max size of the output',
            );
        });

        it('should fail when the same output has been piggybacked', async () => {
            const data = await buildPiggybackOutputData();

            await this.exitGame.setInFlightExit(data.exitId, data.inFlightExitData);

            await this.exitGame.piggybackInFlightExitOnOutput(
                data.outputOneCase.args, { from: outputOwner, value: this.piggybackBondSize.toString() },
            );

            // second piggyback should fail
            await expectRevert(
                this.exitGame.piggybackInFlightExitOnOutput(
                    data.outputOneCase.args, { from: outputOwner, value: this.piggybackBondSize.toString() },
                ),
                'The indexed output has been piggybacked already',
            );
        });

        it('should fail when the output guard handler of the type is not registered', async () => {
            const data = await buildPiggybackOutputData();

            await this.exitGame.setInFlightExit(data.exitId, data.inFlightExitData);

            // output type 2 handler is never registered, thus should fail
            await expectRevert(
                this.exitGame.piggybackInFlightExitOnOutput(
                    data.outputTwoCase.args, { from: outputOwner, value: this.piggybackBondSize.toString() },
                ),
                'Does not have outputGuardHandler registered for the output type',
            );
        });

        it('should fail when the output guard related data is not valid', async () => {
            // Return false when outputGuard handler is checking for output type 2
            const expectedOutputGuardHandler = await ExpectedOutputGuardHandler.new();
            await expectedOutputGuardHandler.mockIsValid(false);
            await expectedOutputGuardHandler.mockGetExitTarget(outputOwner);
            await this.outputGuardHandlerRegistry.registerOutputGuardHandler(
                OUTPUT_TYPE.TWO, expectedOutputGuardHandler.address,
            );

            const data = await buildPiggybackOutputData();

            await this.exitGame.setInFlightExit(data.exitId, data.inFlightExitData);

            await expectRevert(
                this.exitGame.piggybackInFlightExitOnOutput(
                    data.outputTwoCase.args, { from: outputOwner, value: this.piggybackBondSize.toString() },
                ),
                'Some of the output guard related information is not valid',
            );
        });

        it('should fail when not called by the exit target of the output', async () => {
            const data = await buildPiggybackOutputData();
            await this.exitGame.setInFlightExit(data.exitId, data.inFlightExitData);
            await expectRevert(
                this.exitGame.piggybackInFlightExitOnOutput(
                    data.outputOneCase.args, { from: nonOutputOwner, value: this.piggybackBondSize.toString() },
                ),
                'Can be called by the exit target only',
            );
        });

        it('should call the OutputGuardHandler with the expected data', async () => {
            const data = await buildPiggybackOutputData();
            await this.exitGame.setInFlightExit(data.exitId, data.inFlightExitData);

            const expectedOutputGuardData = {
                guard: data.outputTwoCase.outputGuard,
                outputType: data.outputTwoCase.args.outputType,
                preimage: data.outputTwoCase.args.outputGuardPreimage,
            };
            const expectedOutputGuardHandler = await ExpectedOutputGuardHandler.new();
            expectedOutputGuardHandler.mockIsValid(true);
            expectedOutputGuardHandler.mockGetExitTarget(outputOwner);

            // test would revert if data not as expected after setting this
            await expectedOutputGuardHandler.shouldVerifyArgumentEquals(expectedOutputGuardData);
            await this.outputGuardHandlerRegistry.registerOutputGuardHandler(
                OUTPUT_TYPE.TWO, expectedOutputGuardHandler.address,
            );

            await this.exitGame.piggybackInFlightExitOnOutput(
                data.outputTwoCase.args, { from: outputOwner, value: this.piggybackBondSize.toString() },
            );
        });

        describe('When piggyback successfully', () => {
            beforeEach(async () => {
                this.testData = await buildPiggybackOutputData();
                await this.exitGame.setInFlightExit(this.testData.exitId, this.testData.inFlightExitData);

                // set some different timestamp then "now" to the youngest position.
                this.youngestPositionTimestamp = (await time.latest()).sub(new BN(100)).toNumber();
                await this.framework.setBlock(
                    YOUNGEST_POSITION_BLOCK, web3.utils.sha3('dummy root'), this.youngestPositionTimestamp,
                );

                this.piggybackTx = await this.exitGame.piggybackInFlightExitOnOutput(
                    this.testData.outputOneCase.args, { from: outputOwner, value: this.piggybackBondSize.toString() },
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

            it('should not enqueue when it is not first piggyback of the exit on the token', async () => {
                const enqueuedCountBeforePiggyback = (await this.framework.enqueuedCount()).toNumber();

                // set the exit target to output owner
                const handler = await ExpectedOutputGuardHandler.new();
                await handler.mockIsValid(true);
                await handler.mockGetExitTarget(outputOwner);

                await this.outputGuardHandlerRegistry.registerOutputGuardHandler(
                    OUTPUT_TYPE.TWO, handler.address,
                );

                await this.exitGame.piggybackInFlightExitOnOutput(
                    this.testData.outputTwoCase.args, { from: outputOwner, value: this.piggybackBondSize.toString() },
                );
                expect((await this.framework.enqueuedCount()).toNumber()).to.equal(enqueuedCountBeforePiggyback);
            });

            it('should set the exit as piggybacked on the output index', async () => {
                const exit = await this.exitGame.inFlightExits(this.testData.exitId);

                const positionToFlag = MAX_INPUT_SIZE + this.testData.outputOneCase.args.outputIndex;
                const expectedExitMap = (new BN(2)).pow(new BN(positionToFlag));
                expect(new BN(exit.exitMap)).to.be.bignumber.equal(expectedExitMap);
            });

            it('should set a proper piggyback bond size', async () => {
                const exit = await this.exitGame.inFlightExits(this.testData.exitId);

                expect(new BN(exit.outputs[0].piggybackBondSize)).to.be.bignumber.equal(this.piggybackBondSize);
            });

            it('should set the correct exit target to withdraw data on the output of exit data', async () => {
                const exitData = await this.exitGame.getInFlightExitOutput(
                    this.testData.exitId, this.testData.outputOneCase.args.outputIndex,
                );

                expect(exitData.exitTarget).to.equal(outputOwner);
            });

            it('should emit InFlightExitOutputPiggybacked event', async () => {
                await expectEvent.inTransaction(
                    this.piggybackTx.receipt.transactionHash,
                    PaymentPiggybackInFlightExit,
                    'InFlightExitOutputPiggybacked',
                    {
                        exitTarget: outputOwner,
                        txHash: web3.utils.sha3(this.testData.outputOneCase.args.inFlightTx),
                        outputIndex: new BN(this.testData.outputOneCase.args.outputIndex),
                    },
                );
            });
        });
    });
});
