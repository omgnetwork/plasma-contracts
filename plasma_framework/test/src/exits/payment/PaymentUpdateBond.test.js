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
const PaymentStartStandardExit = artifacts.require('PaymentStartStandardExit');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const StateTransitionVerifierMock = artifacts.require('StateTransitionVerifierMock');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');
const { expect } = require('chai');
const { expectEvent, time } = require('openzeppelin-test-helpers');
const { TX_TYPE } = require('../../../helpers/constants.js');

contract('PaymentStandardExitRouter', ([_, outputOwner]) => {
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const PAYMENT_OUTPUT_TYPE = 1;
    const UPDATE_BOND_WAITING_PERIOD = time.duration.days(2);

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

        await PaymentInFlightExitRouter.link('PaymentStartInFlightExit', startInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentPiggybackInFlightExit', piggybackInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFENotCanonical', challengeInFlightExitNotCanonical.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFEInputSpent', challengeIFEInputSpent.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFEOutputSpent', challengeIFEOutputSpent.address);
        await PaymentInFlightExitRouter.link('PaymentProcessInFlightExit', processInFlightExit.address);
    });


    before('setup framework', async () => {
        this.framework = await SpyPlasmaFramework.new(
            MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
        );

        this.ethVault = await SpyEthVault.new(this.framework.address);
        this.erc20Vault = await SpyErc20Vault.new(this.framework.address);
        this.spendingConditionRegistry = await SpendingConditionRegistry.new();
        this.outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();

        this.stateTransitionVerifier = await StateTransitionVerifierMock.new();
        await this.stateTransitionVerifier.mockResult(true);

        const handler = await ExpectedOutputGuardHandler.new(true, outputOwner);
        await this.outputGuardHandlerRegistry.registerOutputGuardHandler(PAYMENT_OUTPUT_TYPE, handler.address);
    });

    describe('updateStartStandardExitBondSize', () => {
        beforeEach(async () => {
            this.exitGame = await PaymentStandardExitRouter.new(
                this.framework.address,
                this.ethVault.address,
                this.erc20Vault.address,
                this.outputGuardHandlerRegistry.address,
                this.spendingConditionRegistry.address,
            );

            this.startStandardExitBondSize = await this.exitGame.startStandardExitBondSize();
            this.newBondSize = this.startStandardExitBondSize.addn(20);
            const { receipt } = await this.exitGame.updateStartStandardExitBondSize(this.newBondSize);
            this.updateTxReceipt = receipt;
        });

        it('should emit an event when the standard exit bond size is updated', async () => {
            await expectEvent.inTransaction(
                this.updateTxReceipt.transactionHash,
                PaymentStandardExitRouter,
                'StandardExitBondUpdated',
                {
                    bondSize: this.newBondSize,
                },
            );
        });

        it('should update the bond value after the waiting period has passed', async () => {
            await time.increase(UPDATE_BOND_WAITING_PERIOD);
            const bondSize = await this.exitGame.startStandardExitBondSize();
            expect(bondSize).to.be.bignumber.equal(this.newBondSize);
        });
    });

    describe('updateStartIFEBondSize', () => {
        beforeEach(async () => {
            this.exitGame = await PaymentInFlightExitRouter.new(
                this.framework.address,
                this.ethVault.address,
                this.erc20Vault.address,
                this.outputGuardHandlerRegistry.address,
                this.spendingConditionRegistry.address,
                this.stateTransitionVerifier.address,
                TX_TYPE.PAYMENT,
            );

            this.startIFEBondSize = await this.exitGame.startIFEBondSize();
            this.newBondSize = this.startIFEBondSize.addn(20);
            const { receipt } = await this.exitGame.updateStartIFEBondSize(this.newBondSize);
            this.updateIFEBondTxReceipt = receipt;
        });

        it('should emit an event when the in-flight exit bond size is updated', async () => {
            await expectEvent.inTransaction(
                this.updateIFEBondTxReceipt.transactionHash,
                PaymentInFlightExitRouter,
                'IFEBondUpdated',
                {
                    bondSize: this.newBondSize,
                },
            );
        });

        it('should update the bond value after the waiting period has passed', async () => {
            await time.increase(UPDATE_BOND_WAITING_PERIOD);
            const bondSize = await this.exitGame.startIFEBondSize();
            expect(bondSize).to.be.bignumber.equal(this.newBondSize);
        });
    });

    describe('updatePiggybackBondSize', () => {
        beforeEach(async () => {
            this.exitGame = await PaymentInFlightExitRouter.new(
                this.framework.address,
                this.ethVault.address,
                this.erc20Vault.address,
                this.outputGuardHandlerRegistry.address,
                this.spendingConditionRegistry.address,
                this.stateTransitionVerifier.address,
                TX_TYPE.PAYMENT,
            );

            this.piggybackBondSize = await this.exitGame.piggybackBondSize();
            this.newBondSize = this.piggybackBondSize.addn(20);
            const { receipt } = await this.exitGame.updatePiggybackBondSize(this.newBondSize);
            this.updatePiggybackBondTxReceipt = receipt;
        });

        it('should emit an event when the in-flight exit bond size is updated', async () => {
            await expectEvent.inTransaction(
                this.updatePiggybackBondTxReceipt.transactionHash,
                PaymentInFlightExitRouter,
                'PiggybackBondUpdated',
                {
                    bondSize: this.newBondSize,
                },
            );
        });

        it('should update the bond value after the waiting period has passed', async () => {
            await time.increase(UPDATE_BOND_WAITING_PERIOD);
            const bondSize = await this.exitGame.piggybackBondSize();
            expect(bondSize).to.be.bignumber.equal(this.newBondSize);
        });
    });
});
