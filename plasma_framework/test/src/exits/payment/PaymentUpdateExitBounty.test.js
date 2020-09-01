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

const { expect } = require('chai');
const { expectEvent, time } = require('openzeppelin-test-helpers');
const { TX_TYPE, VAULT_ID, SAFE_GAS_STIPEND } = require('../../../helpers/constants.js');

contract('PaymentExitGame - Update Exit Bounty', () => {
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const UPDATE_EXIT_BOUNTY_WAITING_PERIOD = time.duration.days(2);

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
        await PaymentInFlightExitRouter.link('PaymentProcessInFlightExit', processInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentDeleteInFlightExit', deleteInFlightExit.address);
    });

    before('setup framework', async () => {
        this.framework = await SpyPlasmaFramework.new(
            MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
        );

        this.ethVault = await SpyEthVault.new(this.framework.address);
        this.erc20Vault = await SpyErc20Vault.new(this.framework.address);

        await this.framework.registerVault(VAULT_ID.ETH, this.ethVault.address);
        await this.framework.registerVault(VAULT_ID.ERC20, this.erc20Vault.address);

        this.spendingConditionRegistry = await SpendingConditionRegistry.new();

        this.stateTransitionVerifier = await StateTransitionVerifierMock.new();
        await this.stateTransitionVerifier.mockResult(true);
    });

    describe('updateProcessStandardExitBountySize', () => {
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
            this.exitGame = await PaymentStandardExitRouter.new();
            await this.exitGame.bootInternal(exitGameArgs);
            this.processStandardExitBountySize = await this.exitGame.processStandardExitBountySize();
            this.newExitBountySize = this.processStandardExitBountySize.addn(20);
            this.updateTx = await this.exitGame.updateProcessStandardExitBountySize(this.newExitBountySize);
        });

        it('should emit an event when the process standard exit bounty size is updated', async () => {
            await expectEvent.inLogs(
                this.updateTx.logs,
                'ProcessStandardExitBountyUpdated',
                {
                    exitBountySize: this.newExitBountySize,
                },
            );
        });

        it('should update the exit bounty value after the waiting period has passed', async () => {
            await time.increase(UPDATE_EXIT_BOUNTY_WAITING_PERIOD);
            const exitBountySize = await this.exitGame.processStandardExitBountySize();
            expect(exitBountySize).to.be.bignumber.equal(this.newExitBountySize);
        });
    });

    describe('updateProcessInFlightExitBountySize', () => {
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
            this.exitGame = await PaymentInFlightExitRouter.new();
            await this.exitGame.bootInternal(exitGameArgs);
            this.processInFlightExitBountySize = await this.exitGame.processInFlightExitBountySize();
            this.newExitBountySize = this.processInFlightExitBountySize.addn(20);
            this.updateIFEBountyTx = await this.exitGame.updateProcessInFlightExitBountySize(this.newExitBountySize);
        });

        it('should emit an event when the in-flight exit bounty size is updated', async () => {
            await expectEvent.inLogs(
                this.updateIFEBountyTx.logs,
                'ProcessInFlightExitBountyUpdated',
                {
                    exitBountySize: this.newExitBountySize,
                },
            );
        });

        it('should update the exit bounty value after the waiting period has passed', async () => {
            await time.increase(UPDATE_EXIT_BOUNTY_WAITING_PERIOD);
            const exitBountySize = await this.exitGame.processInFlightExitBountySize();
            expect(exitBountySize).to.be.bignumber.equal(this.newExitBountySize);
        });
    });
});
