const OutputGuardHandlerRegistry = artifacts.require('OutputGuardHandlerRegistry');
const PaymentInFlightExitRouter = artifacts.require('PaymentInFlightExitRouterMock');
const PaymentStartInFlightExit = artifacts.require('PaymentStartInFlightExit');
const PaymentPiggybackInFlightExit = artifacts.require('PaymentPiggybackInFlightExit');
const PaymentChallengeIFENotCanonical = artifacts.require('PaymentChallengeIFENotCanonical');
const PaymentSpendingConditionRegistry = artifacts.require('PaymentSpendingConditionRegistry');
const PaymentSpendingConditionFalse = artifacts.require('PaymentSpendingConditionFalse');
const PaymentSpendingConditionTrue = artifacts.require('PaymentSpendingConditionTrue');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const StateTransitionVerifierAccept = artifacts.require('StateTransitionVerifierAccept');
const ExitId = artifacts.require('ExitId');
const IsDeposit = artifacts.require('IsDepositWrapper');
const ExitableTimestamp = artifacts.require('ExitableTimestampWrapper');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { addressToOutputGuard } = require('../../../helpers/utils.js');
const { buildUtxoPos } = require('../../../helpers/positions.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../../../helpers/transaction.js');
const { buildValidNoncanonicalChallengeArgs } = require('../../../helpers/ife.js');

contract('PaymentInFlightExitRouter', ([_, ifeOwner, inputOwner, outputOwner, competitorOwner, challenger]) => {
    const CHILD_BLOCK_INTERVAL = 1000;
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week in second
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const OUTPUT_TYPE_ONE = 1;
    const IFE_TX_TYPE = 1;
    const BLOCK_NUMBER = 1000;
    const AMOUNT = 10;
    const YOUNGEST_POSITION_BLOCK = 1000;
    const INFLIGHT_EXIT_YOUNGEST_INPUT_POSITION = buildUtxoPos(YOUNGEST_POSITION_BLOCK, 0, 0);
    const ETH = constants.ZERO_ADDRESS;

    const buildInFlightExitData = async (exitIdHelper) => {
        const emptyWithdrawData = {
            outputId: web3.utils.sha3('dummy output id'),
            exitTarget: constants.ZERO_ADDRESS,
            token: constants.ZERO_ADDRESS,
            amount: 0,
        };

        const outputGuard = addressToOutputGuard(outputOwner);
        const output = new PaymentTransactionOutput(AMOUNT, outputGuard, ETH);
        const inFlightTx = new PaymentTransaction(
            IFE_TX_TYPE, [buildUtxoPos(BLOCK_NUMBER, 0, 0)], [output],
        );

        const inFlightExitData = {
            exitStartTimestamp: (await time.latest()).toNumber(),
            exitMap: 0,
            position: INFLIGHT_EXIT_YOUNGEST_INPUT_POSITION,
            bondOwner: ifeOwner,
            oldestCompetitorPosition: 0,
            inputs: [{
                outputId: web3.utils.sha3('dummy output id'),
                exitTarget: inputOwner,
                token: ETH,
                amount: 999,
            }, emptyWithdrawData, emptyWithdrawData, emptyWithdrawData],
            outputs: [{
                outputId: web3.utils.sha3('dummy output id'),
                exitTarget: constants.ZERO_ADDRESS, // would not be set during start IFE
                token: ETH,
                amount: AMOUNT,
            }, emptyWithdrawData, emptyWithdrawData, emptyWithdrawData],
        };

        const rlpInFlightTxBytes = web3.utils.bytesToHex(inFlightTx.rlpEncoded());
        const exitId = await exitIdHelper.getInFlightExitId(rlpInFlightTxBytes);
        return { exitId, inFlightTx, inFlightExitData };
    };

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
        this.isDeposit = await IsDeposit.new(CHILD_BLOCK_INTERVAL);
        this.exitableHelper = await ExitableTimestamp.new(MIN_EXIT_PERIOD);
        this.stateTransitionVerifierAccept = await StateTransitionVerifierAccept.new();
    });

    describe('challenge in-flight exit non canonical', () => {
        beforeEach(async () => {
            this.framework = await SpyPlasmaFramework.new(
                MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
            );
            this.spendingConditionRegistry = await PaymentSpendingConditionRegistry.new();
            this.outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();
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

            const { exitId, inFlightTx, inFlightExitData } = await buildInFlightExitData(this.exitIdHelper);
            await this.exitGame.setInFlightExit(exitId, inFlightExitData);
            this.inFlightTx = inFlightTx;
            this.exitId = exitId;


            const {
                args: cArgs, block, decodedCompetingTx,
            } = buildValidNoncanonicalChallengeArgs(inFlightTx, competitorOwner);

            this.challengeArgs = cArgs;
            this.competingTx = decodedCompetingTx;
            this.competingTxBlock = block;
        });

        describe('when successfully challenge inFlight exit', () => {
            beforeEach(async () => {
                await this.framework.setBlock(
                    this.competingTxBlock.blockNum,
                    this.competingTxBlock.blockHash,
                    this.competingTxBlock.blockTimestamp,
                );
            });

            it('should emit InFlightExitChallenged event', async () => {
                const { receipt } = await this.exitGame.challengeInFlightExitNotCanonical(
                    this.challengeArgs, { from: challenger },
                );

                const rlpInFlightTxBytes = web3.utils.bytesToHex(this.inFlightTx.rlpEncoded());
                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    PaymentChallengeIFENotCanonical,
                    'InFlightExitChallenged',
                    {
                        challenger,
                        txHash: web3.utils.sha3(rlpInFlightTxBytes),
                        challengeTxPosition: new BN(this.challengeArgs.competingTxPos),
                    },
                );
            });

            it('should set the oldest competitorPosition', async () => {
                const expectedCompetitorPosition = new BN(this.challengeArgs.competingTxPos);

                await this.exitGame.challengeInFlightExitNotCanonical(
                    this.challengeArgs, { from: challenger },
                );

                const exit = await this.exitGame.inFlightExits(this.exitId);

                const oldestCompetitorPosition = new BN(exit.oldestCompetitorPosition);
                expect(oldestCompetitorPosition).to.be.bignumber.equal(expectedCompetitorPosition);
            });

            it('should set the bond owner to challenger', async () => {
                await this.exitGame.challengeInFlightExitNotCanonical(
                    this.challengeArgs, { from: challenger },
                );

                const exit = await this.exitGame.inFlightExits(this.exitId);

                expect(exit.bondOwner).to.be.equal(challenger);
            });

            it('should flag the exit non canonical', async () => {
                await this.exitGame.challengeInFlightExitNotCanonical(
                    this.challengeArgs, { from: challenger },
                );

                const exit = await this.exitGame.inFlightExits(this.exitId);

                expect(exit.isCanonical).to.be.false;
            });
        });

        describe('is unsuccessful and', () => {
            it('fails when competing tx is the same as in-flight one', async () => {
                this.challengeArgs.competingTx = this.challengeArgs.inFlightTx;

                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: challenger }),
                    'The competitor transaction is the same as transaction in-flight',
                );
            });

            it('fails when first phase is over', async () => {
                await time.increase((MIN_EXIT_PERIOD / 2) + 1);

                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: challenger }),
                    'Canonicity challege phase for this exit has ended',
                );
            });

            it('fails when competing tx is not included in the given position', async () => {
                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: challenger }),
                    'Transaction is not included in block of plasma chain.',
                );
            });

            it('fails when ife not started', async () => {
                this.challengeArgs.inFlightTx = this.challengeArgs.competingTx;

                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: challenger }),
                    "In-fligh exit doesn't exists",
                );
            });

            it('fails when spending condition is not met', async () => {
                const newOutputType = 999;

                const conditionFalse = await PaymentSpendingConditionFalse.new();
                await this.spendingConditionRegistry.registerSpendingCondition(
                    newOutputType, IFE_TX_TYPE, conditionFalse.address,
                );

                this.challengeArgs.competingTxInputOutputType = newOutputType;
                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: challenger }),
                    'Competing input spending condition is not met',
                );
            });

            it('fails when spending condition for given output is not registered', async () => {
                this.challengeArgs.competingTxInputOutputType = OUTPUT_TYPE_ONE + 1;

                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: challenger }),
                    'Spending condition contract not found',
                );
            });

            it('fails when competing tx is younger than already known competitor', async () => {
                // challenge ife as previously
                await this.framework.setBlock(
                    this.competingTxBlock.blockNum,
                    this.competingTxBlock.blockHash,
                    this.competingTxBlock.blockTimestamp,
                );

                await this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: challenger });

                // then mine the next block - with the same root hash
                const nextBlockNum = this.competingTxBlock.blockNum + CHILD_BLOCK_INTERVAL;
                const nextBlockTimestamp = this.competingTxBlock.blockTimestamp + 1000;
                const nextCompetitorPos = buildUtxoPos(nextBlockNum, 0, 0);

                await this.framework.setBlock(
                    nextBlockNum, this.competingTxBlock.blockHash, nextBlockTimestamp,
                );

                // try to challenge again with competitor from the lastly mined block
                this.challengeArgs.competingTxPos = nextCompetitorPos;
                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: challenger }),
                    'Competing transaction is not older than already known competitor',
                );
            });

            it('fails when challenge with the same competing tx twice', async () => {
                await this.framework.setBlock(
                    this.competingTxBlock.blockNum,
                    this.competingTxBlock.blockHash,
                    this.competingTxBlock.blockTimestamp,
                );

                await this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: challenger });

                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: challenger }),
                    'Competing transaction is not older than already known competitor',
                );
            });

            it('should set large competitor position when competitor is in-flight', async () => {
                this.challengeArgs.competingTxPos = 0;
                this.challengeArgs.competingTxInclusionProof = '0x';

                // it seems to be solidity `~uint256(0)` - what is important here: it's HUGE
                const expectedCompetitorPos = new BN(2).pow(new BN(256)).sub(new BN(1));

                const { receipt } = await this.exitGame.challengeInFlightExitNotCanonical(
                    this.challengeArgs, { from: challenger },
                );

                const rlpInFlightTxBytes = web3.utils.bytesToHex(this.inFlightTx.rlpEncoded());
                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    PaymentChallengeIFENotCanonical,
                    'InFlightExitChallenged',
                    {
                        challenger,
                        txHash: web3.utils.sha3(rlpInFlightTxBytes),
                        challengeTxPosition: expectedCompetitorPos,
                    },
                );
            });
        });
    });
});
