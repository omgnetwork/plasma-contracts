const PaymentChallengeStandardExit = artifacts.require('PaymentV2ChallengeStandardExit');
const PaymentProcessStandardExit = artifacts.require('PaymentV2ProcessStandardExit');
const PaymentStandardExitRouter = artifacts.require('PaymentV2StandardExitRouterMock');
const PaymentInFlightExitRouter = artifacts.require('PaymentV2InFlightExitRouterMock');
const PaymentStartInFlightExit = artifacts.require('PaymentV2StartInFlightExit');
const PaymentPiggybackInFlightExit = artifacts.require('PaymentV2PiggybackInFlightExit');
const PaymentProcessInFlightExit = artifacts.require('PaymentV2ProcessInFlightExit');
const PaymentChallengeIFENotCanonical = artifacts.require('PaymentV2ChallengeIFENotCanonical');
const PaymentChallengeIFEInputSpent = artifacts.require('PaymentV2ChallengeIFEInputSpent');
const PaymentChallengeIFEOutputSpent = artifacts.require('PaymentV2ChallengeIFEOutputSpent');
const PaymentDeleteInFlightExit = artifacts.require('PaymentV2DeleteInFlightExit');
const PaymentStartStandardExit = artifacts.require('PaymentV2StartStandardExit');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const StateTransitionVerifierMock = artifacts.require('StateTransitionVerifierMock');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');

const { expectRevert } = require('openzeppelin-test-helpers');
const {
    PROTOCOL, TX_TYPE, VAULT_ID, SAFE_GAS_STIPEND,
} = require('../../../helpers/constants.js');

contract('PaymentV2ExitGame - Reentrant Protected', () => {
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;

    before('deploy and link with controller lib', async () => {
        const startStandardExit = await PaymentStartStandardExit.new();
        const challengeStandardExit = await PaymentChallengeStandardExit.new();
        const processStandardExit = await PaymentProcessStandardExit.new();

        await PaymentStandardExitRouter.link('PaymentV2StartStandardExit', startStandardExit.address);
        await PaymentStandardExitRouter.link('PaymentV2ChallengeStandardExit', challengeStandardExit.address);
        await PaymentStandardExitRouter.link('PaymentV2ProcessStandardExit', processStandardExit.address);

        const startInFlightExit = await PaymentStartInFlightExit.new();
        const piggybackInFlightExit = await PaymentPiggybackInFlightExit.new();
        const challengeInFlightExitNotCanonical = await PaymentChallengeIFENotCanonical.new();
        const challengeIFEInputSpent = await PaymentChallengeIFEInputSpent.new();
        const challengeIFEOutputSpent = await PaymentChallengeIFEOutputSpent.new();
        const processInFlightExit = await PaymentProcessInFlightExit.new();
        const deleteInFlightExit = await PaymentDeleteInFlightExit.new();

        await PaymentInFlightExitRouter.link('PaymentV2StartInFlightExit', startInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentV2PiggybackInFlightExit', piggybackInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentV2ChallengeIFENotCanonical', challengeInFlightExitNotCanonical.address);
        await PaymentInFlightExitRouter.link('PaymentV2ChallengeIFEInputSpent', challengeIFEInputSpent.address);
        await PaymentInFlightExitRouter.link('PaymentV2ChallengeIFEOutputSpent', challengeIFEOutputSpent.address);
        await PaymentInFlightExitRouter.link('PaymentV2DeleteInFlightExit', deleteInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentV2ProcessInFlightExit', processInFlightExit.address);
    });

    before('setup condition registries', async () => {
        this.spendingConditionRegistry = await SpendingConditionRegistry.new();

        this.stateTransitionVerifier = await StateTransitionVerifierMock.new();
        await this.stateTransitionVerifier.mockResult(true);
    });

    beforeEach('setup framework', async () => {
        this.framework = await SpyPlasmaFramework.new(
            MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
        );

        this.ethVault = await SpyEthVault.new(this.framework.address);
        this.erc20Vault = await SpyErc20Vault.new(this.framework.address);

        await this.framework.registerVault(VAULT_ID.ETH, this.ethVault.address);
        await this.framework.registerVault(VAULT_ID.ERC20, this.erc20Vault.address);
    });

    describe('standard exit functions are protected', () => {
        beforeEach(async () => {
            const exitGameArgs = [
                this.framework.address,
                VAULT_ID.ETH,
                VAULT_ID.ERC20,
                this.spendingConditionRegistry.address,
                this.stateTransitionVerifier.address,
                TX_TYPE.PAYMENT,
                SAFE_GAS_STIPEND,
            ];
            this.exitGame = await PaymentStandardExitRouter.new(exitGameArgs);

            await this.framework.registerExitGame(TX_TYPE.PAYMENT, this.exitGame.address, PROTOCOL.MORE_VP);
        });

        it('should not be able to re-enter startStandardExit', async () => {
            await expectRevert(
                this.exitGame.testNonReentrant('startStandardExit'),
                'Reentrant call',
            );
        });

        it('should not be able to re-enter challengeStandardExit', async () => {
            await expectRevert(
                this.exitGame.testNonReentrant('challengeStandardExit'),
                'Reentrant call',
            );
        });
    });

    describe('in-flight exit functions are protected', () => {
        beforeEach(async () => {
            const exitGameArgs = [
                this.framework.address,
                VAULT_ID.ETH,
                VAULT_ID.ERC20,
                this.spendingConditionRegistry.address,
                this.stateTransitionVerifier.address,
                TX_TYPE.PAYMENT,
                SAFE_GAS_STIPEND,
            ];
            this.exitGame = await PaymentInFlightExitRouter.new(exitGameArgs);

            await this.framework.registerExitGame(TX_TYPE.PAYMENT, this.exitGame.address, PROTOCOL.MORE_VP);
        });

        it('should not be able to re-enter startInFlightExit', async () => {
            await expectRevert(
                this.exitGame.testNonReentrant('startInFlightExit'),
                'Reentrant call',
            );
        });

        it('should not be able to re-enter piggybackInFlightExitOnInput', async () => {
            await expectRevert(
                this.exitGame.testNonReentrant('piggybackInFlightExitOnInput'),
                'Reentrant call',
            );
        });

        it('should not be able to re-enter piggybackInFlightExitOnOutput', async () => {
            await expectRevert(
                this.exitGame.testNonReentrant('piggybackInFlightExitOnOutput'),
                'Reentrant call',
            );
        });

        it('should not be able to re-enter challengeInFlightExitNotCanonical', async () => {
            await expectRevert(
                this.exitGame.testNonReentrant('challengeInFlightExitNotCanonical'),
                'Reentrant call',
            );
        });

        it('should not be able to re-enter respondToNonCanonicalChallenge', async () => {
            await expectRevert(
                this.exitGame.testNonReentrant('respondToNonCanonicalChallenge'),
                'Reentrant call',
            );
        });

        it('should not be able to re-enter challengeInFlightExitInputSpent', async () => {
            await expectRevert(
                this.exitGame.testNonReentrant('challengeInFlightExitInputSpent'),
                'Reentrant call',
            );
        });

        it('should not be able to re-enter challengeInFlightExitOutputSpent', async () => {
            await expectRevert(
                this.exitGame.testNonReentrant('challengeInFlightExitOutputSpent'),
                'Reentrant call',
            );
        });

        it('should not be able to re-enter deleteNonPiggybackedInFlightExit', async () => {
            await expectRevert(
                this.exitGame.testNonReentrant('deleteNonPiggybackedInFlightExit'),
                'Reentrant call',
            );
        });
    });
});
