const OutputGuardHandlerRegistry = artifacts.require('OutputGuardHandlerRegistry');
const PaymentInFlightExitRouter = artifacts.require('PaymentInFlightExitRouterMock');
const PaymentStartInFlightExit = artifacts.require('PaymentStartInFlightExit');
const PaymentPiggybackInFlightExit = artifacts.require('PaymentPiggybackInFlightExit');
const PaymentProcessInFlightExit = artifacts.require('PaymentProcessInFlightExit');
const PaymentChallengeIFENotCanonical = artifacts.require('PaymentChallengeIFENotCanonical');
const PaymentChallengeIFEInputSpent = artifacts.require('PaymentChallengeIFEInputSpent');
const PaymentChallengeIFEOutputSpent = artifacts.require('PaymentChallengeIFEOutputSpent');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const SpendingConditionMock = artifacts.require('SpendingConditionMock');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');
const StateTransitionVerifierMock = artifacts.require('StateTransitionVerifierMock');
const ExitId = artifacts.require('ExitIdWrapper');
const IsDeposit = artifacts.require('IsDepositWrapper');
const ExitableTimestamp = artifacts.require('ExitableTimestampWrapper');
const OutputId = artifacts.require('OutputIdWrapper');
const ExpectedOutputGuardHandler = artifacts.require('ExpectedOutputGuardHandler');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { PROTOCOL } = require('../../../helpers/constants.js');
const { buildOutputGuard } = require('../../../helpers/utils.js');
const { buildUtxoPos, UtxoPos } = require('../../../helpers/positions.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../../../helpers/transaction.js');
const { createInclusionProof } = require('../../../helpers/ife.js');

contract('PaymentInFlightExitRouter', ([_, ifeOwner, inputOwner, outputOwner, competitorOwner, challenger]) => {
    const DUMMY_IFE_BOND_SIZE = 31415926535; // wei
    const PIGGYBACK_BOND = 31415926535; // wei
    const CHILD_BLOCK_INTERVAL = 1000;
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week in second
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const OUTPUT_TYPE_ONE = 1;
    const IFE_TX_TYPE = 1;
    const YOUNGEST_POSITION_BLOCK = 1000;
    const INFLIGHT_EXIT_YOUNGEST_INPUT_POSITION = buildUtxoPos(YOUNGEST_POSITION_BLOCK, 0, 0);
    const ETH = constants.ZERO_ADDRESS;
    const DUMMY_OUTPUT_ID_FOR_OUTPUT = web3.utils.sha3('dummy output id for output');
    const TEST_IFE_INPUT_AMOUNT = 999;
    const TEST_IFE_OUTPUT_AMOUNT = 990;
    const TEST_COMPETING_TX_OUTPUT_AMOUNT = 990;
    const INPUT_TX_BLOCK_NUM = 1000;
    const INPUT_UTXO_POS = new UtxoPos(buildUtxoPos(INPUT_TX_BLOCK_NUM, 0, 0));
    const COMPETING_TX_BLOCK_NUM = 2000;
    const DUMMY_OUTPUT_GUARD = web3.utils.utf8ToHex('dummy output guard for shared input');
    const DUMMY_CONFIRM_SIG = web3.utils.utf8ToHex('dummy confirm sig for shared input');
    const DUMMY_SPENDING_CONDITION_OPTIONAL_ARGS = web3.utils.utf8ToHex('dummy spending condition optional args');

    const createInputTransaction = () => {
        const output = new PaymentTransactionOutput(TEST_IFE_INPUT_AMOUNT, inputOwner, ETH);
        const inputTx = new PaymentTransaction(
            IFE_TX_TYPE, [buildUtxoPos(0, 0, 0)], [output],
        );

        return {
            inputTx: web3.utils.bytesToHex(inputTx.rlpEncoded()),
            decodedInputTx: inputTx,
        };
    };

    const createCompetitorTransaction = () => {
        const output = new PaymentTransactionOutput(
            TEST_COMPETING_TX_OUTPUT_AMOUNT, buildOutputGuard(OUTPUT_TYPE_ONE, competitorOwner), ETH,
        );
        const competingTx = new PaymentTransaction(IFE_TX_TYPE, [INPUT_UTXO_POS.utxoPos], [output]);
        const competingTxPos = new UtxoPos(buildUtxoPos(COMPETING_TX_BLOCK_NUM, 0, 0));

        return {
            competingTx: web3.utils.bytesToHex(competingTx.rlpEncoded()),
            decodedCompetingTx: competingTx,
            competingTxPos,
        };
    };

    const buildValidNoncanonicalChallengeArgs = (decodedIfeTx) => {
        const { inputTx } = createInputTransaction();

        const { competingTx, decodedCompetingTx, competingTxPos } = createCompetitorTransaction();

        const {
            inclusionProof, blockHash, blockNum, blockTimestamp,
        } = createInclusionProof(
            competingTx, competingTxPos,
        );

        const competingTxWitness = competitorOwner;

        return {
            args: {
                inputTx,
                inputUtxoPos: INPUT_UTXO_POS.utxoPos,
                inFlightTx: web3.utils.bytesToHex(decodedIfeTx.rlpEncoded()),
                inFlightTxInputIndex: 0,
                competingTx,
                competingTxInputIndex: 0,
                outputType: OUTPUT_TYPE_ONE,
                outputGuardPreimage: DUMMY_OUTPUT_GUARD,
                competingTxPos: competingTxPos.utxoPos,
                competingTxInclusionProof: inclusionProof,
                competingTxWitness,
                competingTxConfirmSig: DUMMY_CONFIRM_SIG,
                competingTxSpendingConditionOptionalArgs: DUMMY_SPENDING_CONDITION_OPTIONAL_ARGS,
            },
            block: {
                blockHash, blockNum, blockTimestamp,
            },
            decodedCompetingTx,
        };
    };

    const buildInFlightExitData = async (exitIdHelper, outputIdHelper) => {
        const emptyWithdrawData = {
            outputId: web3.utils.sha3('dummy output id'),
            exitTarget: constants.ZERO_ADDRESS,
            token: constants.ZERO_ADDRESS,
            amount: 0,
            piggybackBondSize: 0,
        };

        const output = new PaymentTransactionOutput(TEST_IFE_OUTPUT_AMOUNT, outputOwner, ETH);
        const inFlightTx = new PaymentTransaction(
            IFE_TX_TYPE, [INPUT_UTXO_POS.utxoPos], [output],
        );

        const { inputTx } = createInputTransaction();
        const outputIdOfInput = await outputIdHelper.computeNormalOutputId(inputTx, INPUT_UTXO_POS.outputIndex);

        const inFlightExitData = {
            exitStartTimestamp: (await time.latest()).toNumber(),
            exitMap: 0,
            position: INFLIGHT_EXIT_YOUNGEST_INPUT_POSITION,
            bondOwner: ifeOwner,
            oldestCompetitorPosition: 0,
            inputs: [{
                outputId: outputIdOfInput,
                exitTarget: inputOwner,
                token: ETH,
                amount: TEST_IFE_INPUT_AMOUNT,
                piggybackBondSize: PIGGYBACK_BOND,
            }, emptyWithdrawData, emptyWithdrawData, emptyWithdrawData],
            outputs: [{
                outputId: DUMMY_OUTPUT_ID_FOR_OUTPUT,
                exitTarget: constants.ZERO_ADDRESS, // would not be set during start IFE
                token: ETH,
                amount: TEST_IFE_OUTPUT_AMOUNT,
                piggybackBondSize: PIGGYBACK_BOND,
            }, emptyWithdrawData, emptyWithdrawData, emptyWithdrawData],
            bondSize: DUMMY_IFE_BOND_SIZE,
        };

        const rlpInFlightTxBytes = web3.utils.bytesToHex(inFlightTx.rlpEncoded());
        const exitId = await exitIdHelper.getInFlightExitId(rlpInFlightTxBytes);
        return { exitId, inFlightTx, inFlightExitData };
    };

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
        this.outputIdHelper = await OutputId.new();
        this.isDeposit = await IsDeposit.new(CHILD_BLOCK_INTERVAL);
        this.exitableHelper = await ExitableTimestamp.new(MIN_EXIT_PERIOD);
        this.stateTransitionVerifier = await StateTransitionVerifierMock.new();
        await this.stateTransitionVerifier.mockResult(true);
    });

    beforeEach(async () => {
        this.framework = await SpyPlasmaFramework.new(
            MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
        );
        const ethVault = await SpyEthVault.new(this.framework.address);
        const erc20Vault = await SpyErc20Vault.new(this.framework.address);
        this.spendingConditionRegistry = await SpendingConditionRegistry.new();
        this.outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();
        this.exitGame = await PaymentInFlightExitRouter.new(
            this.framework.address,
            ethVault.address,
            erc20Vault.address,
            this.outputGuardHandlerRegistry.address,
            this.spendingConditionRegistry.address,
            this.stateTransitionVerifier.address,
            IFE_TX_TYPE,
        );

        this.framework.registerExitGame(IFE_TX_TYPE, this.exitGame.address, PROTOCOL.MORE_VP);

        this.outputGuardHandler = await ExpectedOutputGuardHandler.new();
        await this.outputGuardHandler.mockIsValid(true);
        await this.outputGuardHandler.mockGetConfirmSigAddress(constants.ZERO_ADDRESS);
        await this.outputGuardHandlerRegistry.registerOutputGuardHandler(
            OUTPUT_TYPE_ONE, this.outputGuardHandler.address,
        );

        this.condition = await SpendingConditionMock.new();
        await this.condition.mockResult(true);
        await this.spendingConditionRegistry.registerSpendingCondition(
            OUTPUT_TYPE_ONE, IFE_TX_TYPE, this.condition.address,
        );

        const { exitId, inFlightTx, inFlightExitData } = await buildInFlightExitData(
            this.exitIdHelper, this.outputIdHelper,
        );
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

    describe('challenge in-flight exit non-canonical', () => {
        describe('when successfully challenge inFlight exit', () => {
            beforeEach(async () => {
                await this.framework.setBlock(
                    this.competingTxBlock.blockNum,
                    this.competingTxBlock.blockHash,
                    this.competingTxBlock.blockTimestamp,
                );

                this.challengeIFETx = await this.exitGame.challengeInFlightExitNotCanonical(
                    this.challengeArgs, { from: challenger },
                );
            });

            it('should emit InFlightExitChallenged event', async () => {
                const rlpInFlightTxBytes = web3.utils.bytesToHex(this.inFlightTx.rlpEncoded());
                await expectEvent.inTransaction(
                    this.challengeIFETx.receipt.transactionHash,
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

                const exit = await this.exitGame.inFlightExits(this.exitId);

                const oldestCompetitorPosition = new BN(exit.oldestCompetitorPosition);
                expect(oldestCompetitorPosition).to.be.bignumber.equal(expectedCompetitorPosition);
            });

            it('should set the bond owner to challenger', async () => {
                const exit = await this.exitGame.inFlightExits(this.exitId);

                expect(exit.bondOwner).to.be.equal(challenger);
            });

            it('should flag the exit non-canonical', async () => {
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
                    'Failed to verify the position of competing tx',
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
                await this.condition.mockResult(false);

                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: challenger }),
                    'Competing input spending condition does not met',
                );
            });

            it('fails when spending condition for given output is not registered', async () => {
                this.challengeArgs.outputType = OUTPUT_TYPE_ONE + 1;

                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: challenger }),
                    'Spending condition contract not found',
                );
            });

            it('fails when output guard information is not valid', async () => {
                await this.outputGuardHandler.mockIsValid(false);
                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: challenger }),
                    'Output guard information is invalid',
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

    describe('response to non-canonical challenge', () => {
        beforeEach(async () => {
            await this.framework.setBlock(
                this.competingTxBlock.blockNum,
                this.competingTxBlock.blockHash,
                this.competingTxBlock.blockTimestamp,
            );

            await this.exitGame.challengeInFlightExitNotCanonical(
                this.challengeArgs, { from: challenger },
            );
        });

        describe('when successfully responded to non-canonical challenge', () => {
            beforeEach('include in-flight tx in a previous block', async () => {
                const competitorTxPos = new UtxoPos(this.challengeArgs.competingTxPos);
                const prevBlockNum = competitorTxPos.blockNum - 1000;
                const blockBeforeCompetitorTxPos = new UtxoPos(buildUtxoPos(prevBlockNum, 0, 0));

                const { inclusionProof, blockHash } = createInclusionProof(
                    this.challengeArgs.inFlightTx, blockBeforeCompetitorTxPos,
                );

                this.inFlightTxPos = blockBeforeCompetitorTxPos.utxoPos;
                this.inFlightTxInclusionProof = inclusionProof;

                await this.framework.setBlock(prevBlockNum, blockHash, 1000);
            });

            it('should emit InFlightExitChallengeResponded event', async () => {
                const { receipt } = await this.exitGame.respondToNonCanonicalChallenge(
                    this.challengeArgs.inFlightTx,
                    this.inFlightTxPos,
                    this.inFlightTxInclusionProof,
                    { from: ifeOwner },
                );

                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    PaymentChallengeIFENotCanonical,
                    'InFlightExitChallengeResponded',
                    {
                        challenger: ifeOwner,
                        txHash: web3.utils.sha3(this.challengeArgs.inFlightTx),
                        challengeTxPosition: new BN(this.inFlightTxPos),
                    },
                );
            });

            it('should set isCanonical back to true', async () => {
                await this.exitGame.respondToNonCanonicalChallenge(
                    this.challengeArgs.inFlightTx,
                    this.inFlightTxPos,
                    this.inFlightTxInclusionProof,
                    { from: ifeOwner },
                );

                const exit = await this.exitGame.inFlightExits(this.exitId);

                expect(exit.isCanonical).to.be.true;
            });

            it('should set bond owner to caller', async () => {
                await this.exitGame.respondToNonCanonicalChallenge(
                    this.challengeArgs.inFlightTx,
                    this.inFlightTxPos,
                    this.inFlightTxInclusionProof,
                    { from: ifeOwner },
                );

                const exit = await this.exitGame.inFlightExits(this.exitId);

                expect(exit.bondOwner).to.equal(ifeOwner);
            });

            it('should set oldest competitor position to response position', async () => {
                await this.exitGame.respondToNonCanonicalChallenge(
                    this.challengeArgs.inFlightTx,
                    this.inFlightTxPos,
                    this.inFlightTxInclusionProof,
                    { from: ifeOwner },
                );

                const exit = await this.exitGame.inFlightExits(this.exitId);

                const oldestCompetitorPosition = new BN(exit.oldestCompetitorPosition);
                expect(oldestCompetitorPosition).to.be.bignumber.equal(new BN(this.inFlightTxPos));
            });
        });

        describe('is unsuccessful and', () => {
            it('fails when in-flight exit does not exists', async () => {
                const inflightTx = this.challengeArgs.competingTx;

                await expectRevert(
                    this.exitGame.respondToNonCanonicalChallenge(
                        inflightTx,
                        this.challengeArgs.competingTxPos,
                        this.challengeArgs.competingTxInclusionProof,
                        { from: ifeOwner },
                    ),
                    "In-flight exit doesn't exists",
                );
            });

            it('fails when in-flight transaction is not younger than competitor', async () => {
                await expectRevert(
                    this.exitGame.respondToNonCanonicalChallenge(
                        this.challengeArgs.inFlightTx,
                        this.challengeArgs.competingTxPos,
                        this.challengeArgs.competingTxInclusionProof,
                        { from: ifeOwner },
                    ),
                    'In-flight transaction has to be younger than competitors to respond to non-canonical challenge.',
                );
            });

            it('fails when in-flight transaction is not included in block', async () => {
                const competitorTxPos = new UtxoPos(this.challengeArgs.competingTxPos);
                const blockBeforeCompetitorTxPos = buildUtxoPos(competitorTxPos.blockNum - 1000, 0, 0);

                await expectRevert(
                    this.exitGame.respondToNonCanonicalChallenge(
                        this.challengeArgs.inFlightTx,
                        blockBeforeCompetitorTxPos,
                        this.challengeArgs.competingTxInclusionProof,
                        { from: ifeOwner },
                    ),
                    'Transaction is not included in block of plasma chain.',
                );
            });
        });
    });
});
