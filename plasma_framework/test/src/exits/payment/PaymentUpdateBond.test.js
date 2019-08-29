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

const { expectEvent } = require('openzeppelin-test-helpers');

contract('PaymentStandardExitRouter', ([_, outputOwner]) => {
    const CHILD_BLOCK_INTERVAL = 1000;
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const PAYMENT_OUTPUT_TYPE = 1;
    const EMPTY_BYTES = '0x0000000000000000000000000000000000000000000000000000000000000000000000';

    before('deploy and link with controller lib', async () => {
        const startStandardExit = await PaymentStartStandardExit.new();
        const challengeStandardExit = await PaymentChallengeStandardExit.new();
        const processStandardExit = await PaymentProcessStandardExit.new();

        await PaymentStandardExitRouter.link('PaymentStartStandardExit', startStandardExit.address);
        await PaymentStandardExitRouter.link('PaymentChallengeStandardExit', challengeStandardExit.address);
        await PaymentStandardExitRouter.link('PaymentProcessStandardExit', processStandardExit.address);
    });

    describe('startStandardExit', () => {
        beforeEach(async () => {
            this.framework = await SpyPlasmaFramework.new(
                MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
            );

            const ethVault = await SpyEthVault.new(this.framework.address);
            const erc20Vault = await SpyErc20Vault.new(this.framework.address);
            const spendingConditionRegistry = await PaymentSpendingConditionRegistry.new();
            this.outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();

            const handler = await ExpectedOutputGuardHandler.new(true, outputOwner);
            await this.outputGuardHandlerRegistry.registerOutputGuardHandler(PAYMENT_OUTPUT_TYPE, handler.address);

            this.exitGame = await PaymentStandardExitRouter.new(
                this.framework.address, ethVault.address, erc20Vault.address,
                this.outputGuardHandlerRegistry.address, spendingConditionRegistry.address,
            );

            this.bondSize = await this.exitGame.bondSize();
        });

        it.only('should emit an event when the standard exit bond size is updated', async () => {
            const newBondSize = this.bondSize.muln(2);
            const { receipt } = await this.exitGame.updateBondSize(newBondSize);

            await expectEvent.inTransaction(
                receipt.transactionHash,
                PaymentStandardExitRouter,
                'StandardExitBondUpdated',
                {
                    bondSize: newBondSize,
                },
            );
        });
    });
});
