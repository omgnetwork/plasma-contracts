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
const StateTransitionVerifierMock = artifacts.require('StateTransitionVerifierMock');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');

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

contract('PaymentPiggybackInFlightExitOnOutput', ([_, alice, inputOwner, outputOwner, nonOutputOwner]) => {
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
    const MAX_OUTPUT_SIZE = 4;
    const PAYMENT_TX_TYPE = 1;

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
        await this.stateTransitionVerifier.mockResult(true);
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

    describe('piggybackOnOutput', () => {
        /**
         * This setup IFE data with 1 input and 2 outputs with same owner.
         * */
        const buildPiggybackOutputData = async () => {
            const outputAmount1 = 499;
            const output1 = new PaymentTransactionOutput(OUTPUT_TYPE.ONE, outputAmount1, outputOwner, ETH);

            const outputAmount2 = 498;
            const output2 = new PaymentTransactionOutput(OUTPUT_TYPE.TWO, outputAmount2, outputOwner, ETH);

            const inFlightTx = new PaymentTransaction(1, [buildUtxoPos(BLOCK_NUMBER, 0, 0)], [output1, output2]);
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
                    token: ETH,
                    amount: 999,
                    piggybackBondSize: 0,
                    bountySize: 0,
                }, emptyWithdrawData, emptyWithdrawData, emptyWithdrawData],
                outputs: [{
                    outputId: web3.utils.sha3('dummy output id'),
                    exitTarget: outputOwner,
                    token: ETH,
                    amount: outputAmount1,
                    piggybackBondSize: 0,
                    bountySize: 0,
                }, {
                    outputId: web3.utils.sha3('dummy output id'),
                    exitTarget: outputOwner,
                    token: ETH,
                    amount: outputAmount2,
                    piggybackBondSize: 0,
                    bountySize: 0,
                }, emptyWithdrawData, emptyWithdrawData],
                bondSize: this.startIFEBondSize.toString(),
            };

            const exitId = await this.exitIdHelper.getInFlightExitId(rlpInFlighTxBytes);

            const argsForOutputOne = {
                inFlightTx: rlpInFlighTxBytes,
                outputIndex: 0,
            };

            const argsForOutputTwo = {
                inFlightTx: rlpInFlighTxBytes,
                outputIndex: 1,
            };

            return {
                outputOneCase: {
                    args: argsForOutputOne,
                    amount: outputAmount1,
                },
                outputTwoCase: {
                    args: argsForOutputTwo,
                    amount: outputAmount2,
                },
                exitId,
                inFlightExitData,
            };
        };

        it('should fail when not send with the bond value', async () => {
            const data = await buildPiggybackOutputData();
            await expectRevert(
                this.exitGame.piggybackInFlightExitOnOutput(
                    data.outputOneCase.args, { value: this.processExitBountySize },
                ),
                'Input value must match msg.value',
            );
        });

        it('should fail when not sent with the correct bounty', async () => {
            const data = await buildPiggybackOutputData();
            await expectRevert(
                this.exitGame.piggybackInFlightExitOnOutput(
                    data.outputOneCase.args, { value: this.piggybackBondSize },
                ),
                'Input value must match msg.value',
            );
        });

        it('should fail when no exit to piggyback on', async () => {
            const data = await buildPiggybackOutputData();
            await expectRevert(
                this.exitGame.piggybackInFlightExitOnOutput(
                    data.outputOneCase.args, {
                        from: outputOwner,
                        value: this.piggybackExitTxValue,
                    },
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
                    data.outputOneCase.args, {
                        from: outputOwner,
                        value: this.piggybackExitTxValue,
                    },
                ),
                'Piggyback is possible only in the first phase of the exit period',
            );
        });

        it('should fail when output index exceed max size of tx output', async () => {
            const data = await buildPiggybackOutputData();

            await this.exitGame.setInFlightExit(data.exitId, data.inFlightExitData);

            data.outputOneCase.args.outputIndex = MAX_OUTPUT_SIZE + 1;
            await expectRevert(
                this.exitGame.piggybackInFlightExitOnOutput(
                    data.outputOneCase.args, {
                        from: outputOwner,
                        value: this.piggybackExitTxValue,
                    },
                ),
                'Invalid output index',
            );
        });

        it('should fail when the indexed output is empty', async () => {
            const data = await buildPiggybackOutputData();

            await this.exitGame.setInFlightExit(data.exitId, data.inFlightExitData);

            const indexOfEmptyOutput = 3;
            data.outputOneCase.args.outputIndex = indexOfEmptyOutput;
            await expectRevert(
                this.exitGame.piggybackInFlightExitOnOutput(
                    data.outputOneCase.args, {
                        from: outputOwner,
                        value: this.piggybackExitTxValue,
                    },
                ),
                'Indexed output is empty',
            );
        });

        it('should fail when the same output has been piggybacked', async () => {
            const data = await buildPiggybackOutputData();

            await this.exitGame.setInFlightExit(data.exitId, data.inFlightExitData);

            await this.exitGame.setInFlightExitOutputPiggybacked(
                data.exitId, data.outputOneCase.args.outputIndex,
            );

            await expectRevert(
                this.exitGame.piggybackInFlightExitOnOutput(
                    data.outputOneCase.args, {
                        from: outputOwner,
                        value: this.piggybackExitTxValue,
                    },
                ),
                'Indexed output already piggybacked',
            );
        });

        it('should fail when there is no block for the exit position to enqueue', async () => {
            const data = await buildPiggybackOutputData();

            await this.exitGame.setInFlightExit(data.exitId, data.inFlightExitData);

            await expectRevert(
                this.exitGame.piggybackInFlightExitOnOutput(
                    data.outputOneCase.args, {
                        from: outputOwner,
                        value: this.piggybackExitTxValue,
                    },
                ),
                'There is no block for the exit position to enqueue',
            );
        });

        it('should fail when not called by the exit target of the output', async () => {
            const data = await buildPiggybackOutputData();
            await this.exitGame.setInFlightExit(data.exitId, data.inFlightExitData);
            await expectRevert(
                this.exitGame.piggybackInFlightExitOnOutput(
                    data.outputOneCase.args, {
                        from: nonOutputOwner,
                        value: this.piggybackExitTxValue,
                    },
                ),
                'Can be called only by the exit target',
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
                    this.testData.outputOneCase.args, {
                        from: outputOwner,
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

            it('should NOT enqueue with correct data when it is not the first piggyback of the exit on the token', async () => {
                const originalEnqueuedCount = await this.framework.enqueuedCount();
                await this.exitGame.piggybackInFlightExitOnOutput(
                    this.testData.outputTwoCase.args, {
                        from: outputOwner,
                        value: this.piggybackExitTxValue,
                    },
                );

                expect(await this.framework.enqueuedCount()).to.be.bignumber.equal(originalEnqueuedCount);
            });

            it('should set the exit as piggybacked on the output index', async () => {
                const exits = await this.exitGame.inFlightExits([this.testData.exitId]);

                const positionToFlag = MAX_INPUT_SIZE + this.testData.outputOneCase.args.outputIndex;
                const expectedExitMap = (new BN(2)).pow(new BN(positionToFlag));
                expect(new BN(exits[0].exitMap)).to.be.bignumber.equal(expectedExitMap);
            });

            it('should set a proper piggyback bond size', async () => {
                const exits = await this.exitGame.inFlightExits([this.testData.exitId]);

                expect(new BN(exits[0].outputs[0].piggybackBondSize)).to.be.bignumber.equal(this.piggybackBondSize);
            });

            it('should set the proper bounty size', async () => {
                const exits = await this.exitGame.inFlightExits([this.testData.exitId]);

                expect(new BN(exits[0].outputs[0].bountySize)).to.be.bignumber.equal(this.processExitBountySize);
            });

            it('should set the correct exit target to withdraw data on the output of exit data', async () => {
                const exitData = await this.exitGame.getInFlightExitOutput(
                    this.testData.exitId, this.testData.outputOneCase.args.outputIndex,
                );

                expect(exitData.exitTarget).to.equal(outputOwner);
            });

            it('should emit InFlightExitOutputPiggybacked event', async () => {
                await expectEvent.inLogs(
                    this.piggybackTx.logs,
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
