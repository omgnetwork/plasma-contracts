const ExitId = artifacts.require('ExitIdWrapper');
const PaymentInFlightExitRouter = artifacts.require('PaymentInFlightExitRouterMock');
const PaymentStartInFlightExit = artifacts.require('PaymentStartInFlightExit');
const PaymentPiggybackInFlightExit = artifacts.require('PaymentPiggybackInFlightExit');
const PaymentChallengeIFENotCanonical = artifacts.require('PaymentChallengeIFENotCanonical');
const PaymentChallengeIFEInputSpent = artifacts.require('PaymentChallengeIFEInputSpent');
const PaymentChallengeIFEOutputSpent = artifacts.require('PaymentChallengeIFEOutputSpent');
const PaymentDeleteInFlightExit = artifacts.require('PaymentDeleteInFlightExit');
const PaymentProcessInFlightExit = artifacts.require('PaymentProcessInFlightExit');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const SpendingConditionMock = artifacts.require('SpendingConditionMock');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');
const StateTransitionVerifierMock = artifacts.require('StateTransitionVerifierMock');
const Attacker = artifacts.require('FallbackFunctionFailAttacker');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { buildUtxoPos } = require('../../../../helpers/positions.js');
const { computeNormalOutputId, spentOnGas } = require('../../../../helpers/utils.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../../../../helpers/transaction.js');
const { MerkleTree } = require('../../../../helpers/merkle.js');
const {
    PROTOCOL, TX_TYPE, VAULT_ID, DUMMY_INPUT_1, SAFE_GAS_STIPEND, EMPTY_BYTES_32,
} = require('../../../../helpers/constants.js');

contract('PaymentChallengeIFEOutputSpent', ([_, alice, bob, otherAddress]) => {
    const DUMMY_IFE_BOND_SIZE = 31415926535; // wei
    const PIGGYBACK_BOND = 31415926535;
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const OUTPUT_TYPE_ONE = 1;
    const OUTPUT_TYPE_CHALLENGING_TX = 2;
    const IFE_TX_TYPE = 1;
    const OTHER_TX_TYPE = 2;
    const ETH = constants.ZERO_ADDRESS;
    const AMOUNT = 1;
    const MERKLE_TREE_HEIGHT = 3;
    const DUMMY_WITHDRAW_DATA = {
        outputId: EMPTY_BYTES_32,
        exitTarget: constants.ZERO_ADDRESS,
        token: constants.ZERO_ADDRESS,
        amount: 0,
        piggybackBondSize: 0,
    };
    const BLOCK_NUM = 1000;
    const MAX_NUM_OF_INPUTS = 4;

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
        this.exitIdHelper = await ExitId.new();
        this.stateTransitionVerifier = await StateTransitionVerifierMock.new();
        await this.stateTransitionVerifier.mockResult(true);
    });


    describe('challengeInFlightExitOutputSpent', () => {
        const buildValidChallengeOutputArgs = async () => {
            const output1 = new PaymentTransactionOutput(OUTPUT_TYPE_ONE, AMOUNT, alice, ETH);
            const output2 = new PaymentTransactionOutput(OUTPUT_TYPE_ONE, AMOUNT, alice, ETH);
            const inFlightTx = new PaymentTransaction(IFE_TX_TYPE, [DUMMY_INPUT_1], [output1, output2]);
            const inFlightTxBytes = web3.utils.bytesToHex(inFlightTx.rlpEncoded());

            const merkleTree = new MerkleTree([inFlightTxBytes], MERKLE_TREE_HEIGHT);
            const inclusionProof = merkleTree.getInclusionProof(inFlightTxBytes);

            const outputId = computeNormalOutputId(inFlightTxBytes, 0);
            // different output type for a challenging tx to check if proper spending codition is used
            const challengingTxOutput = new PaymentTransactionOutput(OUTPUT_TYPE_CHALLENGING_TX, AMOUNT, alice, ETH);
            const challengingTx = new PaymentTransaction(IFE_TX_TYPE, [outputId], [challengingTxOutput]);
            const challengingTxBytes = web3.utils.bytesToHex(challengingTx.rlpEncoded());

            const exitId = await this.exitIdHelper.getInFlightExitId(inFlightTxBytes);

            const filler = web3.utils.sha3('filler');
            const inFlightExit = {
                exitStartTimestamp: (await time.latest()).toNumber(),
                exitMap: 2 ** MAX_NUM_OF_INPUTS, // output with index 0 is piggybacked
                position: 0,
                bondOwner: bob,
                bondSize: DUMMY_IFE_BOND_SIZE,
                oldestCompetitorPosition: 0,
                inputs: [{
                    outputId: filler,
                    outputGuard: filler,
                    exitTarget: alice,
                    token: ETH,
                    amount: AMOUNT,
                    piggybackBondSize: PIGGYBACK_BOND,
                }, DUMMY_WITHDRAW_DATA, DUMMY_WITHDRAW_DATA, DUMMY_WITHDRAW_DATA],
                outputs: [{
                    outputId: filler,
                    outputGuard: filler,
                    exitTarget: alice,
                    token: ETH,
                    amount: AMOUNT,
                    piggybackBondSize: PIGGYBACK_BOND,
                }, {
                    outputId: filler,
                    outputGuard: filler,
                    exitTarget: alice,
                    token: ETH,
                    amount: AMOUNT,
                    piggybackBondSize: PIGGYBACK_BOND,
                }, DUMMY_WITHDRAW_DATA, DUMMY_WITHDRAW_DATA],
            };

            return {
                exitId,
                inFlightExit,
                inFlightTxBytes,
                challengingTxBytes,
                blockRoot: merkleTree.root,
                inclusionProof,
                exitingOutputUtxoPos: buildUtxoPos(BLOCK_NUM, 0, 0),
            };
        };

        beforeEach(async () => {
            this.framework = await SpyPlasmaFramework.new(
                MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
            );

            this.spendingConditionRegistry = await SpendingConditionRegistry.new();
            const conditionTrue = await SpendingConditionMock.new();
            await conditionTrue.mockResult(true);
            await this.spendingConditionRegistry.registerSpendingCondition(
                OUTPUT_TYPE_ONE, IFE_TX_TYPE, conditionTrue.address,
            );

            const ethVault = await SpyEthVault.new(this.framework.address);
            const erc20Vault = await SpyErc20Vault.new(this.framework.address);

            await this.framework.registerVault(VAULT_ID.ETH, ethVault.address);
            await this.framework.registerVault(VAULT_ID.ERC20, erc20Vault.address);

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
            await this.framework.registerExitGame(TX_TYPE.PAYMENT, this.exitGame.address, PROTOCOL.MORE_VP);

            const dummyExitGame = await PaymentInFlightExitRouter.new();
            await dummyExitGame.bootInternal(exitGameArgs);
            await this.framework.registerExitGame(OTHER_TX_TYPE, dummyExitGame.address, PROTOCOL.MORE_VP);

            this.piggybackBondSize = await this.exitGame.piggybackBondSize();
            this.exitGame.depositFundForTest({ from: alice, value: this.piggybackBondSize.toString() });

            const args = await buildValidChallengeOutputArgs();

            await this.framework.setBlock(BLOCK_NUM, args.blockRoot, 0);
            await this.exitGame.setInFlightExit(args.exitId, args.inFlightExit);

            this.challengeArgs = {
                inFlightTx: args.inFlightTxBytes,
                inFlightTxInclusionProof: args.inclusionProof,
                outputUtxoPos: buildUtxoPos(BLOCK_NUM, 0, 0),
                challengingTx: args.challengingTxBytes,
                challengingTxInputIndex: 0,
                challengingTxWitness: web3.utils.sha3('sig'),
                senderData: web3.utils.keccak256(bob),
            };
        });

        it('should emit event when challenge is successful', async () => {
            const { logs } = await this.exitGame.challengeInFlightExitOutputSpent(
                this.challengeArgs, { from: bob },
            );
            await expectEvent.inLogs(
                logs,
                'InFlightExitOutputBlocked',
                {
                    challenger: bob,
                    txHash: web3.utils.sha3(this.challengeArgs.inFlightTx),
                    outputIndex: new BN(0),
                },
            );
        });

        it('should pay out bond to the challenger when challenged successfully', async () => {
            const challengerPreBalance = new BN(await web3.eth.getBalance(bob));

            const { receipt } = await this.exitGame.challengeInFlightExitOutputSpent(
                this.challengeArgs, { from: bob },
            );
            const expectedPostBalance = challengerPreBalance
                .add(new BN(PIGGYBACK_BOND))
                .sub(await spentOnGas(receipt));

            const challengerPostBalance = new BN(await web3.eth.getBalance(bob));
            expect(challengerPostBalance).to.be.bignumber.equal(expectedPostBalance);
        });

        it('should fail when paying out piggyback bond fails', async () => {
            const attacker = await Attacker.new();
            this.challengeArgs.senderData = web3.utils.keccak256(attacker.address);

            await expectRevert(
                this.exitGame.challengeInFlightExitOutputSpent(this.challengeArgs, { from: attacker.address }),
                'SafeEthTransfer: failed to transfer ETH',
            );
        });

        it('should not allow to challenge output exit successfully for the second time', async () => {
            await this.exitGame.challengeInFlightExitOutputSpent(
                this.challengeArgs, { from: bob },
            );
            await expectRevert(
                this.exitGame.challengeInFlightExitOutputSpent(this.challengeArgs, { from: bob }),
                'Output is not piggybacked',
            );
        });

        it('should fail when exit is not started', async () => {
            this.challengeArgs.inFlightTx = this.challengeArgs.challengingTx;
            await expectRevert(
                this.exitGame.challengeInFlightExitOutputSpent(this.challengeArgs, { from: bob }),
                'In-flight exit does not exist',
            );
        });

        it('should fail when output is not piggybacked', async () => {
            this.challengeArgs.outputUtxoPos = buildUtxoPos(BLOCK_NUM, 0, 1);
            await expectRevert(
                this.exitGame.challengeInFlightExitOutputSpent(this.challengeArgs, { from: bob }),
                'Output is not piggybacked',
            );
        });

        it('should fail when challenging tx is not of MoreVP protocol', async () => {
            const nonMoreVPTxType = 987;
            const dummyExitGame = await ExitId.new(); // only need a dummy contract address
            this.framework.registerExitGame(nonMoreVPTxType, dummyExitGame.address, PROTOCOL.MVP);

            const outputId = computeNormalOutputId(this.challengeArgs.inFlightTx, 0);
            const challengingTxOutput = new PaymentTransactionOutput(OUTPUT_TYPE_ONE, AMOUNT, alice, ETH);
            const challengingTx = new PaymentTransaction(nonMoreVPTxType, [outputId], [challengingTxOutput]);

            this.challengeArgs.challengingTx = web3.utils.bytesToHex(challengingTx.rlpEncoded());
            await expectRevert(
                this.exitGame.challengeInFlightExitOutputSpent(this.challengeArgs, { from: bob }),
                'MoreVpFinalization: not a MoreVP protocol tx',
            );
        });

        it('should fail when in-flight transaction is not included in Plasma', async () => {
            this.challengeArgs.inFlightTxInclusionProof = web3.utils.bytesToHex('a'.repeat(512));
            await expectRevert(
                this.exitGame.challengeInFlightExitOutputSpent(this.challengeArgs, { from: bob }),
                'In-flight transaction must be standard finalized (included in Plasma) to be able to spend',
            );
        });

        it('should fail when spending condition for challenging tx is not registered', async () => {
            const outputId = computeNormalOutputId(this.challengeArgs.inFlightTx, 0);
            const challengingTxOutput = new PaymentTransactionOutput(OUTPUT_TYPE_ONE, AMOUNT, alice, ETH);
            const challengingTx = new PaymentTransaction(OTHER_TX_TYPE, [outputId], [challengingTxOutput]);

            this.challengeArgs.challengingTx = web3.utils.bytesToHex(challengingTx.rlpEncoded());
            await expectRevert(
                this.exitGame.challengeInFlightExitOutputSpent(this.challengeArgs, { from: bob }),
                'Spending condition contract not found',
            );
        });

        it('should fail when challenging transaction does not spend the output', async () => {
            const outputId = computeNormalOutputId(this.challengeArgs.inFlightTx, 0);
            const challengingTxOutput = new PaymentTransactionOutput(OUTPUT_TYPE_ONE, AMOUNT, alice, ETH);
            const challengingTx = new PaymentTransaction(OTHER_TX_TYPE, [outputId], [challengingTxOutput]);

            this.challengeArgs.challengingTx = web3.utils.bytesToHex(challengingTx.rlpEncoded());

            const conditionFalse = await SpendingConditionMock.new();
            await conditionFalse.mockResult(false);
            await this.spendingConditionRegistry.registerSpendingCondition(
                OUTPUT_TYPE_ONE, OTHER_TX_TYPE, conditionFalse.address,
            );

            await expectRevert(
                this.exitGame.challengeInFlightExitOutputSpent(this.challengeArgs, { from: bob }),
                'Challenging transaction does not spend the output',
            );
        });

        it('should fail when senderData is incorrect', async () => {
            await expectRevert(
                this.exitGame.challengeInFlightExitOutputSpent(this.challengeArgs, { from: otherAddress }),
                'Incorrect senderData',
            );
        });
    });
});
