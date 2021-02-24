const ExitableTimestamp = artifacts.require('ExitableTimestampWrapper');
const ExitId = artifacts.require('ExitIdWrapper');
const OutputId = artifacts.require('OutputIdWrapper');
const PaymentInFlightExitRouter = artifacts.require('PaymentInFlightExitRouterMock');
const PaymentStartInFlightExit = artifacts.require('PaymentStartInFlightExit');
const PaymentPiggybackInFlightExit = artifacts.require('PaymentPiggybackInFlightExit');
const PaymentProcessInFlightExit = artifacts.require('PaymentProcessInFlightExit');
const PaymentChallengeIFENotCanonical = artifacts.require('PaymentChallengeIFENotCanonical');
const PaymentChallengeIFEInputSpent = artifacts.require('PaymentChallengeIFEInputSpent');
const PaymentChallengeIFEOutputSpent = artifacts.require('PaymentChallengeIFEOutputSpent');
const PaymentDeleteInFlightExit = artifacts.require('PaymentDeleteInFlightExit');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const SpendingConditionMock = artifacts.require('SpendingConditionMock');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');
const StateTransitionVerifierMock = artifacts.require('StateTransitionVerifierMock');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const {
    PROTOCOL, OUTPUT_TYPE, VAULT_ID, SAFE_GAS_STIPEND, EMPTY_BYTES_32,
} = require('../../../../helpers/constants.js');
const { buildUtxoPos, Position } = require('../../../../helpers/positions.js');
const {
    PaymentTransactionOutput, PaymentTransaction, PlasmaDepositTransaction,
} = require('../../../../helpers/transaction.js');
const { createInclusionProof } = require('../../../../helpers/ife.js');

contract('PaymentChallengeIFENotCanonical', ([_, ifeOwner, inputOwner, outputOwner, competitorOwner, challenger]) => {
    const DUMMY_IFE_BOND_SIZE = 31415926535; // wei
    const PIGGYBACK_BOND = 31415926535; // wei
    const PROCESS_EXIT_BOUNTY = 31415926535;
    const CHILD_BLOCK_INTERVAL = 1000;
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week in second
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const IFE_TX_TYPE = 1;
    const YOUNGEST_POSITION_BLOCK = 1000;
    const INFLIGHT_EXIT_YOUNGEST_INPUT_POSITION = buildUtxoPos(YOUNGEST_POSITION_BLOCK, 0, 0);
    const ETH = constants.ZERO_ADDRESS;
    const DUMMY_OUTPUT_ID_FOR_OUTPUT = web3.utils.sha3('dummy output id for output');
    const TEST_IFE_INPUT_AMOUNT = 999;
    const TEST_IFE_OUTPUT_AMOUNT = 990;
    const TEST_COMPETING_TX_OUTPUT_AMOUNT = 990;
    const INPUT_TX_BLOCK_NUM = 1000;
    const INPUT_UTXO_POS = new Position(buildUtxoPos(INPUT_TX_BLOCK_NUM, 0, 0));
    const INPUT_DEPOSIT_UTXO_POS = new Position(buildUtxoPos(INPUT_TX_BLOCK_NUM + 1, 0, 0));
    const COMPETING_TX_BLOCK_NUM = 3000;

    const createInputTransaction = (outputType) => {
        const output = new PaymentTransactionOutput(outputType, TEST_IFE_INPUT_AMOUNT, inputOwner, ETH);
        const inputTx = new PaymentTransaction(
            IFE_TX_TYPE, [buildUtxoPos(0, 0, 0)], [output],
        );

        return web3.utils.bytesToHex(inputTx.rlpEncoded());
    };

    const createDepositInputTransaction = (outputType) => {
        const output = new PaymentTransactionOutput(
            outputType, TEST_IFE_INPUT_AMOUNT, inputOwner, ETH,
        );
        const deposit = new PlasmaDepositTransaction(output);

        return web3.utils.bytesToHex(deposit.rlpEncoded());
    };

    const createCompetitorTransaction = (outputType, competingTxType) => {
        const output = new PaymentTransactionOutput(
            outputType, TEST_COMPETING_TX_OUTPUT_AMOUNT, competitorOwner, ETH,
        );
        const competingTx = new PaymentTransaction(competingTxType, [INPUT_UTXO_POS.utxoPos], [output]);
        const competingTxPos = new Position(buildUtxoPos(COMPETING_TX_BLOCK_NUM, 0, 0));

        return {
            competingTx: web3.utils.bytesToHex(competingTx.rlpEncoded()),
            decodedCompetingTx: competingTx,
            competingTxPos,
        };
    };

    const buildValidNoncanonicalChallengeArgs = (
        decodedIfeTx,
        outputType,
        isInputTxDeposit = false,
        competingTxType = IFE_TX_TYPE,
    ) => {
        let inputTx;
        let inputUtxoPos;
        if (isInputTxDeposit) {
            inputTx = createDepositInputTransaction(outputType);
            inputUtxoPos = INPUT_DEPOSIT_UTXO_POS.utxoPos;
        } else {
            inputTx = createInputTransaction(outputType);
            inputUtxoPos = INPUT_UTXO_POS.utxoPos;
        }

        const { competingTx, decodedCompetingTx, competingTxPos } = createCompetitorTransaction(
            outputType,
            competingTxType,
        );

        const {
            inclusionProof, blockHash, blockNum, blockTimestamp,
        } = createInclusionProof(
            competingTx, competingTxPos,
        );

        const competingTxWitness = competitorOwner;

        return {
            args: {
                inputTx,
                inputUtxoPos,
                inFlightTx: web3.utils.bytesToHex(decodedIfeTx.rlpEncoded()),
                inFlightTxInputIndex: 0,
                competingTx,
                competingTxInputIndex: 0,
                competingTxPos: competingTxPos.utxoPos,
                competingTxInclusionProof: inclusionProof,
                competingTxWitness,
            },
            block: {
                blockHash, blockNum, blockTimestamp,
            },
            decodedCompetingTx,
        };
    };

    const buildInFlightExitData = async (exitIdHelper, outputIdHelper, outputType, isInputTxDeposit = false) => {
        const emptyWithdrawData = {
            outputId: EMPTY_BYTES_32,
            exitTarget: constants.ZERO_ADDRESS,
            token: constants.ZERO_ADDRESS,
            amount: 0,
            piggybackBondSize: 0,
            bountySize: 0,
        };

        const output = new PaymentTransactionOutput(outputType, TEST_IFE_OUTPUT_AMOUNT, outputOwner, ETH);
        const inFlightTx = new PaymentTransaction(
            IFE_TX_TYPE, [INPUT_UTXO_POS.utxoPos], [output],
        );

        let outputIdOfInput;
        if (isInputTxDeposit) {
            const deposit = createDepositInputTransaction(outputType);
            outputIdOfInput = await outputIdHelper.computeDepositOutputId(
                deposit,
                INPUT_DEPOSIT_UTXO_POS.outputIndex,
                INPUT_DEPOSIT_UTXO_POS.utxoPos,
            );
        } else {
            const inputTx = createInputTransaction(outputType);
            outputIdOfInput = await outputIdHelper.computeNormalOutputId(inputTx, INPUT_UTXO_POS.outputIndex);
        }

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
                bountySize: PROCESS_EXIT_BOUNTY,
            }, emptyWithdrawData, emptyWithdrawData, emptyWithdrawData],
            outputs: [{
                outputId: DUMMY_OUTPUT_ID_FOR_OUTPUT,
                exitTarget: constants.ZERO_ADDRESS, // would not be set during start IFE
                token: ETH,
                amount: TEST_IFE_OUTPUT_AMOUNT,
                piggybackBondSize: PIGGYBACK_BOND,
                bountySize: PROCESS_EXIT_BOUNTY,
            }, emptyWithdrawData, emptyWithdrawData, emptyWithdrawData, emptyWithdrawData],
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
        const deleteInFlightExit = await PaymentDeleteInFlightExit.new();
        const processInFlightExit = await PaymentProcessInFlightExit.new();

        await PaymentInFlightExitRouter.link('PaymentStartInFlightExit', startInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentPiggybackInFlightExit', piggybackInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFENotCanonical', challengeInFlightExitNotCanonical.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFEInputSpent', challengeIFEInputSpent.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFEOutputSpent', challengeIFEOutputSpent.address);
        await PaymentInFlightExitRouter.link('PaymentDeleteInFlightExit', deleteInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentProcessInFlightExit', processInFlightExit.address);
    });

    before('deploy helper contracts', async () => {
        this.exitIdHelper = await ExitId.new();
        this.outputIdHelper = await OutputId.new();
        this.exitableHelper = await ExitableTimestamp.new(MIN_EXIT_PERIOD);
        this.stateTransitionVerifier = await StateTransitionVerifierMock.new();
        await this.stateTransitionVerifier.mockResult(true);
    });

    beforeEach('deploy framework', async () => {
        this.framework = await SpyPlasmaFramework.new(
            MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
        );
        const ethVault = await SpyEthVault.new(this.framework.address);
        const erc20Vault = await SpyErc20Vault.new(this.framework.address);

        await this.framework.registerVault(VAULT_ID.ETH, ethVault.address);
        await this.framework.registerVault(VAULT_ID.ERC20, erc20Vault.address);

        this.spendingConditionRegistry = await SpendingConditionRegistry.new();

        const exitGameArgs = [
            this.framework.address,
            VAULT_ID.ETH,
            VAULT_ID.ERC20,
            this.spendingConditionRegistry.address,
            this.stateTransitionVerifier.address,
            IFE_TX_TYPE,
            SAFE_GAS_STIPEND,
        ];
        this.exitGame = await PaymentInFlightExitRouter.new();
        await this.exitGame.bootInternal(exitGameArgs);
        this.framework.registerExitGame(IFE_TX_TYPE, this.exitGame.address, PROTOCOL.MORE_VP);

        this.condition = await SpendingConditionMock.new();
        await this.condition.mockResult(true);
        await this.spendingConditionRegistry.registerSpendingCondition(
            OUTPUT_TYPE.PAYMENT, IFE_TX_TYPE, this.condition.address,
        );
    });

    const setInFlightExit = async (outputType, isInputTxDeposit, competingTxType = IFE_TX_TYPE) => {
        const { exitId, inFlightTx, inFlightExitData } = await buildInFlightExitData(
            this.exitIdHelper, this.outputIdHelper, outputType, isInputTxDeposit,
        );
        await this.exitGame.setInFlightExit(exitId, inFlightExitData);
        this.inFlightTx = inFlightTx;
        this.exitId = exitId;

        const {
            args: cArgs, block, decodedCompetingTx,
        } = buildValidNoncanonicalChallengeArgs(inFlightTx, outputType, isInputTxDeposit, competingTxType);

        this.challengeArgs = cArgs;
        this.competingTx = decodedCompetingTx;
        this.competingTxBlock = block;
    };

    beforeEach('set in-flight exit', async () => {
        await setInFlightExit(OUTPUT_TYPE.PAYMENT, false);
    });

    describe('challenge in-flight exit non-canonical', () => {
        beforeEach('set in-flight exit', async () => {
            // override the global IFE test data
            await setInFlightExit(OUTPUT_TYPE.PAYMENT, true);
        });

        it('should successfully challenge when transaction that created input tx is a deposit', async () => {
            await this.framework.setBlock(
                this.competingTxBlock.blockNum,
                this.competingTxBlock.blockHash,
                this.competingTxBlock.blockTimestamp,
            );

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
                    inFlightTxInputIndex: new BN(this.challengeArgs.inFlightTxInputIndex),
                    challengeTx: this.challengeArgs.competingTx,
                    challengeTxInputIndex: new BN(this.challengeArgs.competingTxInputIndex),
                    challengeTxWitness: this.challengeArgs.competingTxWitness.toLowerCase(),
                },
            );
        });
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
                        inFlightTxInputIndex: new BN(this.challengeArgs.inFlightTxInputIndex),
                        challengeTx: this.challengeArgs.competingTx,
                        challengeTxInputIndex: new BN(this.challengeArgs.competingTxInputIndex),
                        challengeTxWitness: this.challengeArgs.competingTxWitness.toLowerCase(),
                    },
                );
            });

            it('should set the oldest competitorPosition', async () => {
                const expectedCompetitorPosition = new BN(this.challengeArgs.competingTxPos);

                const exits = await this.exitGame.inFlightExits([this.exitId]);

                const oldestCompetitorPosition = new BN(exits[0].oldestCompetitorPosition);
                expect(oldestCompetitorPosition).to.be.bignumber.equal(expectedCompetitorPosition);
            });

            it('should set the bond owner to challenger', async () => {
                const exits = await this.exitGame.inFlightExits([this.exitId]);

                expect(exits[0].bondOwner).to.be.equal(challenger);
            });

            it('should flag the exit non-canonical', async () => {
                const exits = await this.exitGame.inFlightExits([this.exitId]);

                expect(exits[0].isCanonical).to.be.false;
            });
        });

        describe('is unsuccessful and', () => {
            it('fails when provided input index is bigger then number of in-flight transaction inputs', async () => {
                this.challengeArgs.inFlightTxInputIndex = 1000;

                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: challenger }),
                    'Input index out of bounds',
                );
            });

            it('fails when competing tx is the same as in-flight one', async () => {
                this.challengeArgs.competingTx = this.challengeArgs.inFlightTx;

                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: challenger }),
                    'The competitor transaction is the same as transaction in-flight',
                );
            });

            it('fails when provided input tx does not match input tx stored in in-flight exit data', async () => {
                this.challengeArgs.inputTx = this.challengeArgs.inFlightTx;

                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: challenger }),
                    'Provided inputs data does not point to the same outputId from the in-flight exit',
                );
            });

            it('fails when first phase is over', async () => {
                await time.increase((MIN_EXIT_PERIOD / 2) + 1);

                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: challenger }),
                    'Canonicity challenge phase for this exit has ended',
                );
            });

            it('fails when competing tx position is not with outputIndex set to 0', async () => {
                this.challengeArgs.competingTxPos = 1;

                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: challenger }),
                    'OutputIndex of competingTxPos should be 0',
                );
            });

            it('fails when competing tx is not included in the given position', async () => {
                const wrongBlockHash = web3.utils.sha3('wrong block hash');
                await this.framework.setBlock(
                    this.competingTxBlock.blockNum,
                    wrongBlockHash,
                    this.competingTxBlock.blockTimestamp,
                );

                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: challenger }),
                    'Competing tx is not standard finalized with the given tx position',
                );
            });

            it('fails when ife not started', async () => {
                this.challengeArgs.inFlightTx = this.challengeArgs.competingTx;

                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: challenger }),
                    'In-flight exit does not exist',
                );
            });

            it('fails when spending condition is not met', async () => {
                await this.condition.mockResult(false);

                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: challenger }),
                    'Competing input spending condition is not met',
                );
            });

            it('fails when spending condition for given output is not registered', async () => {
                const NOT_REGISTERED_OUTPUT_TYPE = 99;

                const { exitId, inFlightTx, inFlightExitData } = await buildInFlightExitData(
                    this.exitIdHelper, this.outputIdHelper, NOT_REGISTERED_OUTPUT_TYPE,
                );
                await this.exitGame.setInFlightExit(exitId, inFlightExitData);

                const { args } = buildValidNoncanonicalChallengeArgs(inFlightTx, NOT_REGISTERED_OUTPUT_TYPE);

                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(args, { from: challenger }),
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

    describe('challenge in-flight exit non-canonical with non MoreVP tx', () => {
        beforeEach('setup MVP protocol tx type', async () => {
            const otherTxType = 3;
            const dummyExitGame = await OutputId.new(); // any contract would work
            this.framework.registerExitGame(otherTxType, dummyExitGame.address, PROTOCOL.MVP);

            await setInFlightExit(OUTPUT_TYPE.PAYMENT, true, otherTxType);
        });

        it('fails when competing tx position is not in a block', async () => {
            await this.framework.setBlock(
                this.competingTxBlock.blockNum,
                this.competingTxBlock.blockHash,
                this.competingTxBlock.blockTimestamp,
            );

            this.challengeArgs.competingTxPos = 0;
            await expectRevert(
                this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: challenger }),
                'MoreVpFinalization: not a MoreVP protocol tx',
            );
        });

        it('fails when competing tx is included in a block', async () => {
            await this.framework.setBlock(
                this.competingTxBlock.blockNum,
                this.competingTxBlock.blockHash,
                this.competingTxBlock.blockTimestamp,
            );

            await expectRevert(
                this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: challenger }),
                'MoreVpFinalization: not a MoreVP protocol tx',
            );
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
                const competitorTxPos = new Position(this.challengeArgs.competingTxPos);
                const prevBlockNum = competitorTxPos.blockNum - 1000;
                const blockBeforeCompetitorTxPos = new Position(buildUtxoPos(prevBlockNum, 0, 0));

                const { inclusionProof, blockHash } = createInclusionProof(
                    this.challengeArgs.inFlightTx, blockBeforeCompetitorTxPos,
                );

                this.inFlightTxPos = blockBeforeCompetitorTxPos.utxoPos;
                this.inFlightTxInclusionProof = inclusionProof;

                await this.framework.setBlock(prevBlockNum, blockHash, 1000);
            });

            it('should emit InFlightExitChallengeResponded event', async () => {
                const { logs } = await this.exitGame.respondToNonCanonicalChallenge(
                    this.challengeArgs.inFlightTx,
                    this.inFlightTxPos,
                    this.inFlightTxInclusionProof,
                    { from: ifeOwner },
                );

                await expectEvent.inLogs(
                    logs,
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

                const exits = await this.exitGame.inFlightExits([this.exitId]);

                expect(exits[0].isCanonical).to.be.true;
            });

            it('should set bond owner to caller', async () => {
                await this.exitGame.respondToNonCanonicalChallenge(
                    this.challengeArgs.inFlightTx,
                    this.inFlightTxPos,
                    this.inFlightTxInclusionProof,
                    { from: ifeOwner },
                );

                const exits = await this.exitGame.inFlightExits([this.exitId]);

                expect(exits[0].bondOwner).to.equal(ifeOwner);
            });

            it('should set oldest competitor position to response position', async () => {
                await this.exitGame.respondToNonCanonicalChallenge(
                    this.challengeArgs.inFlightTx,
                    this.inFlightTxPos,
                    this.inFlightTxInclusionProof,
                    { from: ifeOwner },
                );

                const exits = await this.exitGame.inFlightExits([this.exitId]);

                const oldestCompetitorPosition = new BN(exits[0].oldestCompetitorPosition);
                expect(oldestCompetitorPosition).to.be.bignumber.equal(new BN(this.inFlightTxPos));
            });
        });

        describe('is unsuccessful and', () => {
            beforeEach('include in-flight tx in a previous block', async () => {
                const competitorTxPos = new Position(this.challengeArgs.competingTxPos);
                const prevBlockNum = competitorTxPos.blockNum - 1000;
                const blockBeforeCompetitorTxPos = new Position(buildUtxoPos(prevBlockNum, 0, 0));

                const { inclusionProof, blockHash } = createInclusionProof(
                    this.challengeArgs.inFlightTx, blockBeforeCompetitorTxPos,
                );

                this.inFlightTxPos = blockBeforeCompetitorTxPos.utxoPos;
                this.inFlightTxInclusionProof = inclusionProof;

                await this.framework.setBlock(prevBlockNum, blockHash, 1000);
            });

            it('fails when in-flight exit does not exists', async () => {
                const notExitingInflightTx = this.challengeArgs.competingTx;

                await expectRevert(
                    this.exitGame.respondToNonCanonicalChallenge(
                        notExitingInflightTx,
                        this.inFlightTxPos,
                        this.inFlightTxInclusionProof,
                        { from: ifeOwner },
                    ),
                    'In-flight exit does not exist',
                );
            });

            it('fails when in-flight transaction is not older than competitor', async () => {
                const nonYoungerThenCompetitorPosition = this.challengeArgs.competingTxPos;
                await expectRevert(
                    this.exitGame.respondToNonCanonicalChallenge(
                        this.challengeArgs.inFlightTx,
                        nonYoungerThenCompetitorPosition,
                        this.inFlightTxInclusionProof,
                        { from: ifeOwner },
                    ),
                    'In-flight transaction must be older than competitors to respond to non-canonical challenge',
                );
            });

            it('fails when in-flight transaction position is 0', async () => {
                const noBlockExistingPosition = buildUtxoPos(0, 0, 0);
                await expectRevert(
                    this.exitGame.respondToNonCanonicalChallenge(
                        this.challengeArgs.inFlightTx,
                        noBlockExistingPosition,
                        this.inFlightTxInclusionProof,
                        { from: ifeOwner },
                    ),
                    'In-flight transaction position must not be 0',
                );
            });

            it('fails when outputIndex of in-flight transaction position is not 0', async () => {
                const wrongPosition = new Position(this.inFlightTxPos);
                wrongPosition.outputIndex = 123;

                await expectRevert(
                    this.exitGame.respondToNonCanonicalChallenge(
                        this.challengeArgs.inFlightTx,
                        buildUtxoPos(wrongPosition.blockNum, wrongPosition.txIndex, wrongPosition.outputIndex),
                        this.inFlightTxInclusionProof,
                        { from: ifeOwner },
                    ),
                    'Output index of txPos has to be 0',
                );
            });

            it('fails when the block of the in-flight tx position does not exist', async () => {
                const validIFEBlockNum = (new Position(this.inFlightTxPos)).blockNum;
                const noBlockExistingPosition = buildUtxoPos(validIFEBlockNum - 1000, 0, 0);
                await expectRevert(
                    this.exitGame.respondToNonCanonicalChallenge(
                        this.challengeArgs.inFlightTx,
                        noBlockExistingPosition,
                        this.inFlightTxInclusionProof,
                        { from: ifeOwner },
                    ),
                    'Failed to get the block root hash of the tx position',
                );
            });

            it('fails when in-flight transaction is not included in block', async () => {
                const inclusionProof = this.inFlightTxInclusionProof;
                const wrongInclusionProof = inclusionProof.substring(0, inclusionProof.length - 1).concat('e');
                await expectRevert(
                    this.exitGame.respondToNonCanonicalChallenge(
                        this.challengeArgs.inFlightTx,
                        this.inFlightTxPos,
                        wrongInclusionProof,
                        { from: ifeOwner },
                    ),
                    'Transaction is not included in block of Plasma chain',
                );
            });
        });
    });
});
