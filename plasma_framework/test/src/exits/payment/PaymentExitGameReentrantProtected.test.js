const ExpectedOutputGuardHandler = artifacts.require('ExpectedOutputGuardHandler');
const OutputGuardHandlerRegistry = artifacts.require('OutputGuardHandlerRegistry');
const PaymentChallengeStandardExit = artifacts.require('PaymentChallengeStandardExit');
const PaymentProcessStandardExit = artifacts.require('PaymentProcessStandardExit');
const PaymentStandardExitRouter = artifacts.require('PaymentStandardExitRouterMock');
const PaymentInFlightExitRouter = artifacts.require('PaymentInFlightExitRouterMock');
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
const TxFinalizationVerifier = artifacts.require('TxFinalizationVerifier');

const { expectRevert } = require('openzeppelin-test-helpers');
const {
    PROTOCOL, TX_TYPE, VAULT_ID, SAFE_GAS_STIPEND,
} = require('../../../helpers/constants.js');

contract('PaymentExitGame - Reentrant Protected', ([_, outputOwner]) => {
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const PAYMENT_OUTPUT_TYPE = 1;

    before('deploy and link with controller lib', async () => {
        const startStandardExit = await PaymentStartStandardExit.new();
        const challengeStandardExit = await PaymentChallengeStandardExit.new();
        const processStandardExit = await PaymentProcessStandardExit.new();

        await PaymentStandardExitRouter.link('PaymentStartStandardExit', startStandardExit.address);
        await PaymentStandardExitRouter.link('PaymentChallengeStandardExit', challengeStandardExit.address);
        await PaymentStandardExitRouter.link('PaymentProcessStandardExit', processStandardExit.address);

        const startInFlightExit = await PaymentStartInFlightExit.new();
        const piggybackInFlightExit = await PaymentPiggybackInFlightExit.new();
        const challengeInFlightExitNotCanonical = await PaymentChallengeIFENotCanonical.new();
        const challengeIFEInputSpent = await PaymentChallengeIFEInputSpent.new();
        const challengeIFEOutputSpent = await PaymentChallengeIFEOutputSpent.new();
        const processInFlightExit = await PaymentProcessInFlightExit.new();
        const deleteInFlightExit = await PaymentDeleteInFlightExit.new();

        await PaymentInFlightExitRouter.link('PaymentStartInFlightExit', startInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentPiggybackInFlightExit', piggybackInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFENotCanonical', challengeInFlightExitNotCanonical.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFEInputSpent', challengeIFEInputSpent.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFEOutputSpent', challengeIFEOutputSpent.address);
        await PaymentInFlightExitRouter.link('PaymentDeleteInFlightExit', deleteInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentProcessInFlightExit', processInFlightExit.address);
    });

    before('setup output guard handler and condition registries', async () => {
        this.spendingConditionRegistry = await SpendingConditionRegistry.new();
        this.outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();

        this.stateTransitionVerifier = await StateTransitionVerifierMock.new();
        await this.stateTransitionVerifier.mockResult(true);

        const handler = await ExpectedOutputGuardHandler.new(true, outputOwner);
        await this.outputGuardHandlerRegistry.registerOutputGuardHandler(PAYMENT_OUTPUT_TYPE, handler.address);

        this.txFinalizationVerifier = await TxFinalizationVerifier.new();
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
                this.outputGuardHandlerRegistry.address,
                this.spendingConditionRegistry.address,
                this.stateTransitionVerifier.address,
                this.txFinalizationVerifier.address,
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
                this.outputGuardHandlerRegistry.address,
                this.spendingConditionRegistry.address,
                this.stateTransitionVerifier.address,
                this.txFinalizationVerifier.address,
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
