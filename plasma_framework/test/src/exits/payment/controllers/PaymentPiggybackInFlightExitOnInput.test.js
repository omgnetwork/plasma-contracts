const ExitIdWrapper = artifacts.require('ExitIdWrapper');
const PaymentChallengeIFENotCanonical = artifacts.require('PaymentChallengeIFENotCanonical');
const PaymentChallengeIFEInputSpent = artifacts.require('PaymentChallengeIFEInputSpent');
const PaymentChallengeIFEOutputSpent = artifacts.require('PaymentChallengeIFEOutputSpent');
const PaymentDeleteInFlightExit = artifacts.require('PaymentDeleteInFlightExit');
const PaymentInFlightExitRouter = artifacts.require('PaymentInFlightExitRouterMock');
const PaymentPiggybackInFlightExit = artifacts.require('PaymentPiggybackInFlightExit');
const PaymentStartInFlightExit = artifacts.require('PaymentStartInFlightExit');
const PaymentProcessInFlightExit = artifacts.require('PaymentProcessInFlightExit');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');
const StateTransitionVerifierMock = artifacts.require('StateTransitionVerifierMock');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { calculateNormalExitable } = require('../../../../helpers/exitable.js');
const { buildUtxoPos, txPostionForExitPriority } = require('../../../../helpers/positions.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../../../../helpers/transaction.js');
const {
    PROTOCOL, TX_TYPE, VAULT_ID, SAFE_GAS_STIPEND, EMPTY_BYTES_32,
} = require('../../../../helpers/constants.js');

contract('PaymentPiggybackInFlightExitOnInput', ([_, alice, inputOwner, nonInputOwner, outputOwner]) => {
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

    before('deploy helper contracts', async () => {
        this.exitIdHelper = await ExitIdWrapper.new();
        this.stateTransitionVerifier = await StateTransitionVerifierMock.new();
    });

    beforeEach(async () => {
        this.framework = await SpyPlasmaFramework.new(
            MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
        );

        const ethVault = await SpyEthVault.new(this.framework.address);
        const erc20Vault = await SpyErc20Vault.new(this.framework.address);

        await this.framework.registerVault(VAULT_ID.ETH, ethVault.address);
        await this.framework.registerVault(VAULT_ID.ERC20, erc20Vault.address);

        const spendingConditionRegistry = await SpendingConditionRegistry.new();

        const exitGameArgs = [
            this.framework.address,
            VAULT_ID.ETH,
            VAULT_ID.ERC20,
            spendingConditionRegistry.address,
            this.stateTransitionVerifier.address,
            PAYMENT_TX_TYPE,
            SAFE_GAS_STIPEND,
        ];
        this.exitGame = await PaymentInFlightExitRouter.new();
        await this.exitGame.bootInternal(exitGameArgs);
        await this.framework.registerExitGame(TX_TYPE.PAYMENT, this.exitGame.address, PROTOCOL.MORE_VP);

        this.startIFEBondSize = await this.exitGame.startIFEBondSize();
        this.piggybackBondSize = await this.exitGame.piggybackBondSize();

        this.processExitBountySize = await this.exitGame.processInFlightExitBountySize();
        this.piggybackExitTxValue = this.piggybackBondSize.add(this.processExitBountySize);
    });

    describe('piggybackOnInput', () => {
        /** This setup IFE data with 2 inputs with same owner and 1 output.
         *  First input uses output type 1
         *  Second input uses output type 2
         */
        const buildPiggybackInputData = async (firstInputToken = ETH) => {
            const outputAmount = 997;
            const output = new PaymentTransactionOutput(OUTPUT_TYPE.PAYMENT, outputAmount, outputOwner, ETH);

            const dummyInputUtxopos1 = buildUtxoPos(BLOCK_NUMBER, 0, 0);
            const dummyInputUtxopos2 = buildUtxoPos(BLOCK_NUMBER, 1, 0);
            const inFlightTx = new PaymentTransaction(1, [dummyInputUtxopos1, dummyInputUtxopos2], [output]);
            const rlpInFlighTxBytes = web3.utils.bytesToHex(inFlightTx.rlpEncoded());

            const emptyWithdrawData = {
                outputId: EMPTY_BYTES_32,
                exitTarget: constants.ZERO_ADDRESS,
                token: constants.ZERO_ADDRESS,
                amount: 0,
                piggybackBondSize: 0,
                bountySize: 0,
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
                    bountySize: 0,
                }, {
                    outputId: web3.utils.sha3('dummy output id'),
                    exitTarget: inputOwner,
                    token: ETH,
                    amount: 998,
                    piggybackBondSize: 0,
                    bountySize: 0,
                }, emptyWithdrawData, emptyWithdrawData],
                outputs: [{
                    outputId: web3.utils.sha3('dummy output id'),
                    exitTarget: outputOwner,
                    token: ETH,
                    amount: outputAmount,
                    piggybackBondSize: 0,
                    bountySize: 0,
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

        it('should fail when not sent with the bond value', async () => {
            const { argsInputOne } = await buildPiggybackInputData();
            await expectRevert(
                this.exitGame.piggybackInFlightExitOnInput(
                    argsInputOne, { value: this.processExitBountySize },
                ),
                'Input value must match msg.value',
            );
        });

        it('should fail when not sent with the correct bounty', async () => {
            const { argsInputOne } = await buildPiggybackInputData();
            await expectRevert(
                this.exitGame.piggybackInFlightExitOnInput(
                    argsInputOne, { value: this.piggybackBondSize },
                ),
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
                    data.argsInputOne, {
                        from: inputOwner,
                        value: this.piggybackExitTxValue,
                    },
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
                    data.argsInputOne, {
                        from: inputOwner,
                        value: this.piggybackExitTxValue,
                    },
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
                    data.argsInputOne, {
                        from: inputOwner,
                        value: this.piggybackExitTxValue,
                    },
                ),
                'Invalid input index',
            );
        });

        it('should fail when the input is empty', async () => {
            const data = await buildPiggybackInputData();
            await this.exitGame.setInFlightExit(data.exitId, data.inFlightExitData);

            const indexOfEmptyInput = 3;
            data.argsInputOne.inputIndex = indexOfEmptyInput;
            await expectRevert(
                this.exitGame.piggybackInFlightExitOnInput(
                    data.argsInputOne, {
                        from: inputOwner,
                        value: this.piggybackExitTxValue,
                    },
                ),
                'Indexed input is empty',
            );
        });

        it('should fail when the same input has been piggybacked', async () => {
            const data = await buildPiggybackInputData();
            await this.exitGame.setInFlightExit(data.exitId, data.inFlightExitData);

            await this.exitGame.setInFlightExitInputPiggybacked(data.exitId, data.argsInputOne.inputIndex);

            await expectRevert(
                this.exitGame.piggybackInFlightExitOnInput(
                    data.argsInputOne, {
                        from: inputOwner,
                        value: this.piggybackExitTxValue,
                    },
                ),
                'Indexed input already piggybacked',
            );
        });

        it('should fail when not called by the exit target of the output', async () => {
            const data = await buildPiggybackInputData();
            await this.exitGame.setInFlightExit(data.exitId, data.inFlightExitData);
            await expectRevert(
                this.exitGame.piggybackInFlightExitOnInput(
                    data.argsInputOne, {
                        from: nonInputOwner,
                        value: this.piggybackExitTxValue,
                    },
                ),
                'Can be called only by the exit target',
            );
        });

        it('should fail when there is no block for the exit position to enqueue', async () => {
            const data = await buildPiggybackInputData();
            await this.exitGame.setInFlightExit(data.exitId, data.inFlightExitData);
            await expectRevert(
                this.exitGame.piggybackInFlightExitOnInput(
                    data.argsInputOne, {
                        from: inputOwner,
                        value: this.piggybackExitTxValue,
                    },
                ),
                'There is no block for the exit position to enqueue',
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
                    this.testData.argsInputOne, {
                        from: inputOwner,
                        value: this.piggybackExitTxValue,
                    },
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
                        txPos: new BN(txPostionForExitPriority(INFLIGHT_EXIT_YOUNGEST_INPUT_POSITION)),
                        exitProcessor: this.exitGame.address,
                        exitId: this.testData.exitId,
                    },
                );
            });

            it('should not enqueue when it is not first piggyback of the exit on the same token', async () => {
                const enqueuedCountBeforePiggyback = (await this.framework.enqueuedCount()).toNumber();
                await this.exitGame.piggybackInFlightExitOnInput(
                    this.testData.argsInputTwo, {
                        from: inputOwner,
                        value: this.piggybackExitTxValue,
                    },
                );
                expect((await this.framework.enqueuedCount()).toNumber()).to.equal(enqueuedCountBeforePiggyback);
            });

            it('should set the exit as piggybacked on the input index', async () => {
                const exits = await this.exitGame.inFlightExits([this.testData.exitId]);

                // input index = 0 --> flag the right most position to 1 on exit map thus equals 1
                expect(new BN(exits[0].exitMap)).to.be.bignumber.equal(new BN(1));
            });

            it('should set a proper piggyback bond size', async () => {
                const exits = await this.exitGame.inFlightExits([this.testData.exitId]);

                expect(new BN(exits[0].inputs[0].piggybackBondSize)).to.be.bignumber.equal(this.piggybackBondSize);
            });

            it('should set the proper bounty size', async () => {
                const exits = await this.exitGame.inFlightExits([this.testData.exitId]);

                expect(new BN(exits[0].inputs[0].bountySize)).to.be.bignumber.equal(this.processExitBountySize);
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
                    this.testData.argsInputOne, {
                        from: inputOwner,
                        value: this.piggybackExitTxValue,
                    },
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
                        txPos: new BN(txPostionForExitPriority(INFLIGHT_EXIT_YOUNGEST_INPUT_POSITION)),
                        exitProcessor: this.exitGame.address,
                        exitId: this.testData.exitId,
                    },
                );
            });
        });
    });
});
