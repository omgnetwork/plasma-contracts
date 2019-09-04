const OutputGuardHandler = artifacts.require('ExpectedOutputGuardHandler');
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
    BN, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { buildUtxoPos } = require('../../../helpers/positions.js');

const { buildValidIfeStartArgs, buildValidNoncanonicalChallengeArgs } = require('../../../helpers/ife.js');

contract('PaymentInFlightExitRouter', ([_, alice, bob, carol]) => {
    const IN_FLIGHT_EXIT_BOND = 31415926535; // wei
    const CHILD_BLOCK_INTERVAL = 1000;
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const OUTPUT_TYPE_ONE = 1;
    const IFE_TX_TYPE = 1;
    const BLOCK_NUMBER = 1000;
    const DEPOSIT_BLOCK_NUMBER = BLOCK_NUMBER + 1;
    const AMOUNT = 10;

    before('deploy and link with controller lib', async () => {
        const startInFlightExit = await PaymentStartInFlightExit.new();
        const piggybackInFlightExit = await PaymentPiggybackInFlightExit.new();
        const challengeInFlightExitNotCanonical = await PaymentChallengeIFENotCanonical.new();

        await PaymentInFlightExitRouter.link('PaymentStartInFlightExit', startInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentPiggybackInFlightExit', piggybackInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFENotCanonical', challengeInFlightExitNotCanonical.address);

        this.exitIdHelper = await ExitId.new();
        this.isDeposit = await IsDeposit.new(CHILD_BLOCK_INTERVAL);
        this.exitableHelper = await ExitableTimestamp.new(MIN_EXIT_PERIOD);
        this.stateTransitionVerifierAccept = await StateTransitionVerifierAccept.new();

        this.outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();
        const handler = await OutputGuardHandler.new(true, alice);
        await this.outputGuardHandlerRegistry.registerOutputGuardHandler(OUTPUT_TYPE_ONE, handler.address);
    });

    describe('challenge in-flight exit non canonical', () => {
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

            const {
                args,
                argsDecoded,
                inputTxsBlockRoot1,
                inputTxsBlockRoot2,
            } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
            this.args = args;
            this.argsDecoded = argsDecoded;
            await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
            await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

            const conditionTrue = await PaymentSpendingConditionTrue.new();

            await this.spendingConditionRegistry.registerSpendingCondition(
                OUTPUT_TYPE_ONE, IFE_TX_TYPE, conditionTrue.address,
            );

            await this.exitGame.startInFlightExit(
                this.args,
                { from: alice, value: IN_FLIGHT_EXIT_BOND },
            );

            const {
                args: cArgs, block, decodedCompetingTx,
            } = buildValidNoncanonicalChallengeArgs(this.argsDecoded.inFlightTx, bob);

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
                    this.challengeArgs, { from: alice },
                );

                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    PaymentChallengeIFENotCanonical,
                    'InFlightExitChallenged',
                    {
                        challenger: alice,
                        txHash: web3.utils.sha3(this.args.inFlightTx),
                        challengeTxPosition: new BN(this.challengeArgs.competingTxPos),
                    },
                );
            });

            it('should set the oldest competitorPosition', async () => {
                const expectedCompetitorPosition = new BN(this.challengeArgs.competingTxPos);

                await this.exitGame.challengeInFlightExitNotCanonical(
                    this.challengeArgs, { from: alice },
                );

                const exitId = await this.exitIdHelper.getInFlightExitId(this.args.inFlightTx);
                const exit = await this.exitGame.inFlightExits(exitId);

                const oldestCompetitorPosition = new BN(exit.oldestCompetitorPosition);
                expect(oldestCompetitorPosition).to.be.bignumber.equal(expectedCompetitorPosition);
            });

            it('should set the bond owner to challenger', async () => {
                await this.exitGame.challengeInFlightExitNotCanonical(
                    this.challengeArgs, { from: bob },
                );

                const exitId = await this.exitIdHelper.getInFlightExitId(this.args.inFlightTx);
                const exit = await this.exitGame.inFlightExits(exitId);

                expect(exit.bondOwner).to.be.equal(bob);
            });

            it('should flag the exit non canonical', async () => {
                await this.exitGame.challengeInFlightExitNotCanonical(
                    this.challengeArgs, { from: alice },
                );

                const exitId = await this.exitIdHelper.getInFlightExitId(this.args.inFlightTx);
                const exit = await this.exitGame.inFlightExits(exitId);

                expect(exit.isCanonical).to.be.false;
            });
        });

        describe('is unsuccessful and', () => {
            it('fails when competing tx is the same as in-flight one', async () => {
                this.challengeArgs.competingTx = this.challengeArgs.inFlightTx;

                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: alice }),
                    'The competitor transaction is the same as transaction in-flight',
                );
            });

            it('fails when first phase is over', async () => {
                await time.increase((MIN_EXIT_PERIOD / 2) + 1);

                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: alice }),
                    'Canonicity challege phase for this exit has ended',
                );
            });

            it('fails when competing tx is not included in the given position', async () => {
                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: alice }),
                    'Transaction is not included in block of plasma chain.',
                );
            });

            it('fails when ife not started', async () => {
                this.challengeArgs.inFlightTx = this.challengeArgs.competingTx;

                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: alice }),
                    "In-fligh exit doesn't exists",
                );
            });

            it('fails when spending condition is not met', async () => {
                const newOutputType = OUTPUT_TYPE_ONE + 1;

                const conditionFalse = await PaymentSpendingConditionFalse.new();
                await this.spendingConditionRegistry.registerSpendingCondition(
                    newOutputType, IFE_TX_TYPE, conditionFalse.address,
                );

                this.challengeArgs.competingTxInputOutputType = newOutputType;
                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: alice }),
                    'Competing input spending condition is not met',
                );
            });

            it('fails when spending condition for given output is not registered', async () => {
                this.challengeArgs.competingTxInputOutputType = OUTPUT_TYPE_ONE + 1;

                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: alice }),
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

                await this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: alice });

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
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: alice }),
                    'Competing transaction is not older than already known competitor',
                );
            });

            it('fails when challenge with the same competing tx twice', async () => {
                await this.framework.setBlock(
                    this.competingTxBlock.blockNum,
                    this.competingTxBlock.blockHash,
                    this.competingTxBlock.blockTimestamp,
                );

                await this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: alice });

                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: alice }),
                    'Competing transaction is not older than already known competitor',
                );
            });

            it('should set large competitor position when competitor is in-flight', async () => {
                this.challengeArgs.competingTxPos = 0;
                this.challengeArgs.competingTxInclusionProof = '0x';

                // it seems to be solidity `~uint256(0)` - what is important here: it's HUGE
                const expectedCompetitorPos = new BN(2).pow(new BN(256)).sub(new BN(1));

                const { receipt } = await this.exitGame.challengeInFlightExitNotCanonical(
                    this.challengeArgs, { from: alice },
                );

                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    PaymentChallengeIFENotCanonical,
                    'InFlightExitChallenged',
                    {
                        challenger: alice,
                        txHash: web3.utils.sha3(this.args.inFlightTx),
                        challengeTxPosition: expectedCompetitorPos,
                    },
                );
            });
        });
    });
});
