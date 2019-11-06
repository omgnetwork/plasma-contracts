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
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');
const StateTransitionVerifierMock = artifacts.require('StateTransitionVerifierMock');
const TxFinalizationVerifier = artifacts.require('TxFinalizationVerifier');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { calculateNormalExitable } = require('../../../helpers/exitable.js');
const { buildUtxoPos, utxoPosToTxPos } = require('../../../helpers/positions.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../../../helpers/transaction.js');
const { PROTOCOL, TX_TYPE, VAULT_ID } = require('../../../helpers/constants.js');

contract('PaymentInFlightExitRouter', ([_, alice, inputOwner, nonInputOwner, outputOwner]) => {
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
    const ERC20_TOKEN = '0x0000000000000000000000000000000000000001';

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
        this.txFinalizationVerifier = await TxFinalizationVerifier.new();
    });

    beforeEach(async () => {
        this.framework = await SpyPlasmaFramework.new(
            MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
        );

        const ethVault = await SpyEthVault.new(this.framework.address);
        const erc20Vault = await SpyErc20Vault.new(this.framework.address);

        await this.framework.registerVault(VAULT_ID.ETH, ethVault.address);
        await this.framework.registerVault(VAULT_ID.ERC20, erc20Vault.address);

        this.outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();
        const spendingConditionRegistry = await SpendingConditionRegistry.new();

        this.exitGame = await PaymentInFlightExitRouter.new(
            this.framework.address,
            VAULT_ID.ETH,
            VAULT_ID.ERC20,
            this.outputGuardHandlerRegistry.address,
            spendingConditionRegistry.address,
            this.stateTransitionVerifier.address,
            this.txFinalizationVerifier.address,
            PAYMENT_TX_TYPE,
        );

        await this.framework.registerExitGame(TX_TYPE.PAYMENT, this.exitGame.address, PROTOCOL.MORE_VP);

        this.startIFEBondSize = await this.exitGame.startIFEBondSize();
        this.piggybackBondSize = await this.exitGame.piggybackBondSize();
    });

    describe('piggybackOnInput', () => {
        /** This setup IFE data with 2 inputs with same owner and 1 output.
         *  First input uses output type 1, this uses the default outputguard handler in tests.
         *  Second input uses output type 2, so we can register custom outputguard handler for tests.
         */
        const buildPiggybackInputData = async (firstInputToken = ETH) => {
            const outputAmount = 997;
            const outputGuard = outputOwner;
            const output = new PaymentTransactionOutput(OUTPUT_TYPE.PAYMENT, outputAmount, outputGuard, ETH);

            const dummyInputUtxopos1 = buildUtxoPos(BLOCK_NUMBER, 0, 0);
            const dummyInputUtxopos2 = buildUtxoPos(BLOCK_NUMBER, 1, 0);
            const inFlightTx = new PaymentTransaction(1, [dummyInputUtxopos1, dummyInputUtxopos2], [output]);
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
                    token: firstInputToken,
                    amount: 999,
                    piggybackBondSize: 0,
                }, {
                    outputId: web3.utils.sha3('dummy output id'),
                    exitTarget: inputOwner,
                    token: ETH,
                    amount: 998,
                    piggybackBondSize: 0,
                }, emptyWithdrawData, emptyWithdrawData],
                outputs: [{
                    outputId: web3.utils.sha3('dummy output id'),
                    exitTarget: outputOwner,
                    token: ETH,
                    amount: outputAmount,
                    piggybackBondSize: 0,
                }, emptyWithdrawData, emptyWithdrawData, emptyWithdrawData],
                bondSize: this.startIFEBondSize.toString(),
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
                'Input value must match msg.value',
            );
        });

        it('should fail when no exit to piggyback on', async () => {
            const data = await buildPiggybackInputData();
            await this.exitGame.setInFlightExit(data.exitId, data.inFlightExitData);

            const nonExistingTx = '0x';
            data.argsInputOne.inFlightTx = nonExistingTx;
            await expectRevert(
                this.exitGame.piggybackInFlightExitOnInput(
                    data.argsInputOne, { from: inputOwner, value: this.piggybackBondSize.toString() },
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
                    data.argsInputOne, { from: inputOwner, value: this.piggybackBondSize.toString() },
                ),
                'Piggyback is possible only in the first phase of the exit period',
            );
        });

        it('should fail when input index exceed max size of tx input', async () => {
            const data = await buildPiggybackInputData();
            await this.exitGame.setInFlightExit(data.exitId, data.inFlightExitData);

            const inputIndexExceedSize = MAX_INPUT_SIZE + 1;
            data.argsInputOne.inputIndex = inputIndexExceedSize;
            await expectRevert(
                this.exitGame.piggybackInFlightExitOnInput(
                    data.argsInputOne, { from: inputOwner, value: this.piggybackBondSize.toString() },
                ),
                'Invalid input index',
            );
        });

        it('should fail when the same input has been piggybacked', async () => {
            const data = await buildPiggybackInputData();
            await this.exitGame.setInFlightExit(data.exitId, data.inFlightExitData);
            await this.exitGame.piggybackInFlightExitOnInput(
                data.argsInputOne, { from: inputOwner, value: this.piggybackBondSize.toString() },
            );

            // second attmept should fail
            await expectRevert(
                this.exitGame.piggybackInFlightExitOnInput(
                    data.argsInputOne, { from: inputOwner, value: this.piggybackBondSize.toString() },
                ),
                'Indexed input already piggybacked',
            );
        });

        it('should fail when not called by the exit target of the output', async () => {
            const data = await buildPiggybackInputData();
            await this.exitGame.setInFlightExit(data.exitId, data.inFlightExitData);
            await expectRevert(
                this.exitGame.piggybackInFlightExitOnInput(
                    data.argsInputOne, { from: nonInputOwner, value: this.piggybackBondSize.toString() },
                ),
                'Can be called only by the exit target',
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
                await this.framework.addExitQueue(VAULT_ID.ETH, ETH);

                this.piggybackTx = await this.exitGame.piggybackInFlightExitOnInput(
                    this.testData.argsInputOne, { from: inputOwner, value: this.piggybackBondSize.toString() },
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
                        vaultId: new BN(VAULT_ID.ETH),
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
                await expectedOutputGuardHandler.mockIsValid(true);
                await expectedOutputGuardHandler.mockGetExitTarget(inputOwner);

                await this.outputGuardHandlerRegistry.registerOutputGuardHandler(
                    OUTPUT_TYPE.TWO, expectedOutputGuardHandler.address,
                );

                const enqueuedCountBeforePiggyback = (await this.framework.enqueuedCount()).toNumber();
                await this.exitGame.piggybackInFlightExitOnInput(
                    this.testData.argsInputTwo, { from: inputOwner, value: this.piggybackBondSize.toString() },
                );
                expect((await this.framework.enqueuedCount()).toNumber()).to.equal(enqueuedCountBeforePiggyback);
            });

            it('should set the exit as piggybacked on the input index', async () => {
                const exit = await this.exitGame.inFlightExits(this.testData.exitId);

                // input index = 0 --> flag the right most position to 1 on exit map thus equals 1
                expect(new BN(exit.exitMap)).to.be.bignumber.equal(new BN(1));
            });

            it('should set a proper piggyback bond size', async () => {
                const exit = await this.exitGame.inFlightExits(this.testData.exitId);

                expect(new BN(exit.inputs[0].piggybackBondSize)).to.be.bignumber.equal(this.piggybackBondSize);
            });

            it('should emit InFlightExitInputPiggybacked event', async () => {
                await expectEvent.inLogs(
                    this.piggybackTx.logs,
                    'InFlightExitInputPiggybacked',
                    {
                        exitTarget: inputOwner,
                        txHash: web3.utils.sha3(this.testData.argsInputOne.inFlightTx),
                        inputIndex: new BN(this.testData.argsInputOne.index),
                    },
                );
            });
        });

        describe('When piggyback successfully on ERC20 input', () => {
            beforeEach(async () => {
                this.testData = await buildPiggybackInputData(ERC20_TOKEN);

                // set some different timestamp then "now" to the youngest position.
                this.youngestPositionTimestamp = (await time.latest()).sub(new BN(100)).toNumber();
                await this.framework.setBlock(
                    YOUNGEST_POSITION_BLOCK, web3.utils.sha3('dummy root'), this.youngestPositionTimestamp,
                );
                await this.exitGame.setInFlightExit(this.testData.exitId, this.testData.inFlightExitData);
                await this.framework.addExitQueue(VAULT_ID.ERC20, ERC20_TOKEN);

                this.piggybackTx = await this.exitGame.piggybackInFlightExitOnInput(
                    this.testData.argsInputOne, { from: inputOwner, value: this.piggybackBondSize.toString() },
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
                        vaultId: new BN(VAULT_ID.ERC20),
                        token: ERC20_TOKEN,
                        exitableAt: new BN(exitableAt),
                        txPos: new BN(utxoPosToTxPos(INFLIGHT_EXIT_YOUNGEST_INPUT_POSITION)),
                        exitProcessor: this.exitGame.address,
                        exitId: this.testData.exitId,
                    },
                );
            });
        });
    });
});
