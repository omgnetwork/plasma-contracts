const PaymentChallengeStandardExit = artifacts.require('PaymentChallengeStandardExit');
const PaymentProcessStandardExit = artifacts.require('PaymentProcessStandardExit');
const PaymentStandardExitRouter = artifacts.require('PaymentStandardExitRouterMock');
const PaymentInFlightExitRouter = artifacts.require('PaymentInFlightExitRouterMock');
const PaymentExitGame = artifacts.require('PaymentExitGame');
const PaymentStartInFlightExit = artifacts.require('PaymentStartInFlightExit');
const PaymentPiggybackInFlightExit = artifacts.require('PaymentPiggybackInFlightExit');
const PaymentProcessInFlightExit = artifacts.require('PaymentProcessInFlightExit');
const PaymentChallengeIFENotCanonical = artifacts.require('PaymentChallengeIFENotCanonical');
const PaymentChallengeIFEInputSpent = artifacts.require('PaymentChallengeIFEInputSpent');
const PaymentChallengeIFEOutputSpent = artifacts.require('PaymentChallengeIFEOutputSpent');
const PaymentDeleteInFlightExit = artifacts.require('PaymentDeleteInFlightExit');
const PaymentStartStandardExit = artifacts.require('PaymentStartStandardExit');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const StateTransitionVerifierMock = artifacts.require('StateTransitionVerifierMock');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');

const { expectRevert } = require('openzeppelin-test-helpers');
const {
    PROTOCOL, TX_TYPE, VAULT_ID, SAFE_GAS_STIPEND,
} = require('../../../helpers/constants.js');

contract('PaymentExitGame - Reentrant Protected', () => {
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;

    before('deploy and link with controller lib', async () => {
        const startStandardExit = await PaymentStartStandardExit.new();
        const challengeStandardExit = await PaymentChallengeStandardExit.new();
        const processStandardExit = await PaymentProcessStandardExit.new();

        await PaymentExitGame.link('PaymentStartStandardExit', startStandardExit.address);
        await PaymentExitGame.link('PaymentChallengeStandardExit', challengeStandardExit.address);
        await PaymentExitGame.link('PaymentProcessStandardExit', processStandardExit.address);

        //await PaymentStandardExitRouter.link('PaymentStartStandardExit', startStandardExit.address);
        //await PaymentStandardExitRouter.link('PaymentChallengeStandardExit', challengeStandardExit.address);
        //await PaymentStandardExitRouter.link('PaymentProcessStandardExit', processStandardExit.address);

        const startInFlightExit = await PaymentStartInFlightExit.new();
        const piggybackInFlightExit = await PaymentPiggybackInFlightExit.new();
        const challengeInFlightExitNotCanonical = await PaymentChallengeIFENotCanonical.new();
        const challengeIFEInputSpent = await PaymentChallengeIFEInputSpent.new();
        const challengeIFEOutputSpent = await PaymentChallengeIFEOutputSpent.new();
        const processInFlightExit = await PaymentProcessInFlightExit.new();
        const deleteInFlightExit = await PaymentDeleteInFlightExit.new();

        // await PaymentInFlightExitRouter.link('PaymentStartInFlightExit', startInFlightExit.address);
        // await PaymentInFlightExitRouter.link('PaymentPiggybackInFlightExit', piggybackInFlightExit.address);
        // await PaymentInFlightExitRouter.link('PaymentChallengeIFENotCanonical', challengeInFlightExitNotCanonical.address);
        // await PaymentInFlightExitRouter.link('PaymentChallengeIFEInputSpent', challengeIFEInputSpent.address);
        // await PaymentInFlightExitRouter.link('PaymentChallengeIFEOutputSpent', challengeIFEOutputSpent.address);
        // await PaymentInFlightExitRouter.link('PaymentDeleteInFlightExit', deleteInFlightExit.address);
        // await PaymentInFlightExitRouter.link('PaymentProcessInFlightExit', processInFlightExit.address);
        await PaymentExitGame.link('PaymentStartInFlightExit', startInFlightExit.address);
        await PaymentExitGame.link('PaymentPiggybackInFlightExit', piggybackInFlightExit.address);
        await PaymentExitGame.link('PaymentChallengeIFENotCanonical', challengeInFlightExitNotCanonical.address);
        await PaymentExitGame.link('PaymentChallengeIFEInputSpent', challengeIFEInputSpent.address);
        await PaymentExitGame.link('PaymentChallengeIFEOutputSpent', challengeIFEOutputSpent.address);
        await PaymentExitGame.link('PaymentDeleteInFlightExit', deleteInFlightExit.address);
        await PaymentExitGame.link('PaymentProcessInFlightExit', processInFlightExit.address);
    });

    before('setup condition registries', async () => {
        this.spendingConditionRegistry = await SpendingConditionRegistry.new();
        await this.spendingConditionRegistry.renounceOwnership();
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
            this.exitGame = await PaymentExitGame.new(exitGameArgs);
            await this.exitGame.init();
            await this.framework.registerExitGame(TX_TYPE.PAYMENT, this.exitGame.address, PROTOCOL.MORE_VP);
            this.exitGame = await PaymentStandardExitRouter.deployed();
        });

        it.only('should not be able to re-enter startStandardExit', async () => {
            await expectRevert(
                this.exitGame.testNonReentrant('startStandardExit'),
                'Reentrant call',
            );
        });

        it.only('should not be able to re-enter challengeStandardExit', async () => {
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
            this.exitGame = await PaymentExitGame.new(exitGameArgs);
            await this.exitGame.init();
            await this.framework.registerExitGame(TX_TYPE.PAYMENT, this.exitGame.address, PROTOCOL.MORE_VP);
            this.exitGame = await PaymentInFlightExitRouter.deployed();
        });

        it.only('should not be able to re-enter startInFlightExit', async () => {
            await expectRevert(
                this.exitGame.testNonReentrant('startInFlightExit'),
                'Reentrant call',
            );
        });

        it.only('should not be able to re-enter piggybackInFlightExitOnInput', async () => {
            await expectRevert(
                this.exitGame.testNonReentrant('piggybackInFlightExitOnInput'),
                'Reentrant call',
            );
        });

        it.only('should not be able to re-enter piggybackInFlightExitOnOutput', async () => {
            await expectRevert(
                this.exitGame.testNonReentrant('piggybackInFlightExitOnOutput'),
                'Reentrant call',
            );
        });

        it.only('should not be able to re-enter challengeInFlightExitNotCanonical', async () => {
            await expectRevert(
                this.exitGame.testNonReentrant('challengeInFlightExitNotCanonical'),
                'Reentrant call',
            );
        });

        it.only('should not be able to re-enter respondToNonCanonicalChallenge', async () => {
            await expectRevert(
                this.exitGame.testNonReentrant('respondToNonCanonicalChallenge'),
                'Reentrant call',
            );
        });

        it.only('should not be able to re-enter challengeInFlightExitInputSpent', async () => {
            await expectRevert(
                this.exitGame.testNonReentrant('challengeInFlightExitInputSpent'),
                'Reentrant call',
            );
        });

        it.only('should not be able to re-enter challengeInFlightExitOutputSpent', async () => {
            await expectRevert(
                this.exitGame.testNonReentrant('challengeInFlightExitOutputSpent'),
                'Reentrant call',
            );
        });

        it.only('should not be able to re-enter deleteNonPiggybackedInFlightExit', async () => {
            await expectRevert(
                this.exitGame.testNonReentrant('deleteNonPiggybackedInFlightExit'),
                'Reentrant call',
            );
        });
    });
});
