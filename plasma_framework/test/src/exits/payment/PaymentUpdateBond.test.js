const ExpectedOutputGuardHandler = artifacts.require('ExpectedOutputGuardHandler');
const OutputGuardHandlerRegistry = artifacts.require('OutputGuardHandlerRegistry');
const PaymentChallengeStandardExit = artifacts.require('PaymentChallengeStandardExit');
const PaymentProcessStandardExit = artifacts.require('PaymentProcessStandardExit');
const PaymentStandardExitRouter = artifacts.require('PaymentStandardExitRouterMock');
const PaymentStartStandardExit = artifacts.require('PaymentStartStandardExit');
const PaymentSpendingConditionRegistry = artifacts.require('PaymentSpendingConditionRegistry');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');
const { expect } = require('chai');
const { expectEvent, time } = require('openzeppelin-test-helpers');

contract('PaymentStandardExitRouter', ([operator, outputOwner]) => {
    const CHILD_BLOCK_INTERVAL = 1000;
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const PAYMENT_OUTPUT_TYPE = 1;
    const EMPTY_BYTES = '0x0000000000000000000000000000000000000000000000000000000000000000000000';
    const UPDATE_BOND_WAITING_PERIOD = time.duration.days(2);

    before('deploy and link with controller lib', async () => {
        const startStandardExit = await PaymentStartStandardExit.new();
        const challengeStandardExit = await PaymentChallengeStandardExit.new();
        const processStandardExit = await PaymentProcessStandardExit.new();

        await PaymentStandardExitRouter.link('PaymentStartStandardExit', startStandardExit.address);
        await PaymentStandardExitRouter.link('PaymentChallengeStandardExit', challengeStandardExit.address);
        await PaymentStandardExitRouter.link('PaymentProcessStandardExit', processStandardExit.address);
    });

    describe('updateStartStandardExitBondSize', () => {
        beforeEach(async () => {
            this.framework = await SpyPlasmaFramework.new(
                MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
            );

            const ethVault = await SpyEthVault.new(this.framework.address);
            const erc20Vault = await SpyErc20Vault.new(this.framework.address);
            const spendingConditionRegistry = await PaymentSpendingConditionRegistry.new();
            this.outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new(operator);

            const handler = await ExpectedOutputGuardHandler.new(true, outputOwner);
            await this.outputGuardHandlerRegistry.registerOutputGuardHandler(PAYMENT_OUTPUT_TYPE, handler.address);

            this.exitGame = await PaymentStandardExitRouter.new(
                this.framework.address, ethVault.address, erc20Vault.address,
                this.outputGuardHandlerRegistry.address, spendingConditionRegistry.address,
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
});
