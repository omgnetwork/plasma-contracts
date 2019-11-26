const PlasmaFramework = artifacts.require('PlasmaFramework');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const OutputGuardHandlerRegistry = artifacts.require('OutputGuardHandlerRegistry');
const PaymentTransactionStateTransitionVerifier = artifacts.require('PaymentTransactionStateTransitionVerifier');
const TxFinalizationVerifier = artifacts.require('TxFinalizationVerifier');
const PaymentStandardExitRouter = artifacts.require('PaymentStandardExitRouterMock');
const PaymentChallengeStandardExit = artifacts.require('PaymentChallengeStandardExit');
const PaymentProcessStandardExit = artifacts.require('PaymentProcessStandardExit');
const PaymentStartStandardExit = artifacts.require('PaymentStartStandardExit');

const { expectRevert } = require('openzeppelin-test-helpers');

const config = require('../../../../config.js');

contract('PaymentStandardExitRouter', () => {
    before('get deployed contracts and link libraries', async () => {
        const plasmaFramework = await PlasmaFramework.deployed();
        const outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.deployed();
        const spendingConditionRegistry = await SpendingConditionRegistry.deployed();
        const txVerifier = await TxFinalizationVerifier.deployed();
        const stateTransitionVerifier = await PaymentTransactionStateTransitionVerifier.deployed();

        const startStandardExit = await PaymentStartStandardExit.new();
        const challengeStandardExit = await PaymentChallengeStandardExit.new();
        const processStandardExit = await PaymentProcessStandardExit.new();

        await PaymentStandardExitRouter.link('PaymentStartStandardExit', startStandardExit.address);
        await PaymentStandardExitRouter.link('PaymentChallengeStandardExit', challengeStandardExit.address);
        await PaymentStandardExitRouter.link('PaymentProcessStandardExit', processStandardExit.address);

        this.exitGameArgs = {
            framework: plasmaFramework.address,
            outputGuardHandlerRegistry: outputGuardHandlerRegistry.address,
            spendingConditionRegistry: spendingConditionRegistry.address,
            stateTransitionVerifier: stateTransitionVerifier.address,
            txFinalizationVerifier: txVerifier.address,
            supportTxType: config.registerKeys.txTypes.payment,
            safeGasStipend: config.frameworks.safeGasStipend.v1,
        };
    });

    it('should fail when being deployed with unset ETH vault', async () => {
        const notRegisteredEthVaultId = config.registerKeys.vaultId.eth + 10;
        this.exitGameArgs.ethVaultId = notRegisteredEthVaultId;
        this.exitGameArgs.erc20VaultId = config.registerKeys.vaultId.erc20;
        await expectRevert(
            PaymentStandardExitRouter.new(this.exitGameArgs),
            'Invalid ETH vault',
        );
    });

    it('should fail when being deployed with unset ERC20 vault', async () => {
        const notRegisteredErc20VaultId = config.registerKeys.vaultId.erc20 + 10;
        this.exitGameArgs.ethVaultId = config.registerKeys.vaultId.eth;
        this.exitGameArgs.erc20VaultId = notRegisteredErc20VaultId;

        await expectRevert(
            PaymentStandardExitRouter.new(this.exitGameArgs),
            'Invalid ERC20 vault',
        );
    });
});
