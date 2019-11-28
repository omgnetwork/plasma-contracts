const PlasmaFramework = artifacts.require('PlasmaFramework');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const OutputGuardHandlerRegistry = artifacts.require('OutputGuardHandlerRegistry');
const PaymentTransactionStateTransitionVerifier = artifacts.require('PaymentTransactionStateTransitionVerifier');
const TxFinalizationVerifier = artifacts.require('TxFinalizationVerifier');
const PaymentInFlightExitRouter = artifacts.require('PaymentInFlightExitRouterMock');
const PaymentStartInFlightExit = artifacts.require('PaymentStartInFlightExit');
const PaymentPiggybackInFlightExit = artifacts.require('PaymentPiggybackInFlightExit');
const PaymentChallengeIFENotCanonical = artifacts.require('PaymentChallengeIFENotCanonical');
const PaymentChallengeIFEInputSpent = artifacts.require('PaymentChallengeIFEInputSpent');
const PaymentChallengeIFEOutputSpent = artifacts.require('PaymentChallengeIFEOutputSpent');
const PaymentDeleteInFlightExit = artifacts.require('PaymentDeleteInFlightExit');
const PaymentProcessInFlightExit = artifacts.require('PaymentProcessInFlightExit');

const { expectRevert } = require('openzeppelin-test-helpers');

const config = require('../../../../config.js');

contract('PaymentInFlightExitRouter', () => {
    before('get deployed contracts and link libraries', async () => {
        const plasmaFramework = await PlasmaFramework.deployed();
        const outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.deployed();
        const spendingConditionRegistry = await SpendingConditionRegistry.deployed();
        const txVerifier = await TxFinalizationVerifier.deployed();
        const stateTransitionVerifier = await PaymentTransactionStateTransitionVerifier.deployed();


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
            PaymentInFlightExitRouter.new(this.exitGameArgs),
            'Invalid ETH vault',
        );
    });

    it('should fail when being deployed with unset ERC20 vault', async () => {
        const notRegisteredErc20VaultId = config.registerKeys.vaultId.erc20 + 10;
        this.exitGameArgs.ethVaultId = config.registerKeys.vaultId.eth;
        this.exitGameArgs.erc20VaultId = notRegisteredErc20VaultId;

        await expectRevert(
            PaymentInFlightExitRouter.new(this.exitGameArgs),
            'Invalid ERC20 vault',
        );
    });
});
