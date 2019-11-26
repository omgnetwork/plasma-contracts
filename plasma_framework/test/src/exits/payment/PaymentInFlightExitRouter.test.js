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
const PaymentProcessInFlightExit = artifacts.require('PaymentProcessInFlightExit');

const { expectRevert } = require('openzeppelin-test-helpers');

const config = require('../../../../config.js');

contract('PaymentInFlightExitRouter', () => {
    before('get deployed contracts and link libraries', async () => {
        this.plasmaFramework = await PlasmaFramework.deployed();
        this.outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.deployed();
        this.spendingConditionRegistry = await SpendingConditionRegistry.deployed();
        this.txVerifier = await TxFinalizationVerifier.deployed();
        this.stateTransitionVerifier = await PaymentTransactionStateTransitionVerifier.deployed();


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

    it('should fail when being deployed with unset ETH vault', async () => {
        const notRegisteredEthVaultId = config.registerKeys.vaultId.eth + 10;
        await expectRevert(
            PaymentInFlightExitRouter.new(
                this.plasmaFramework.address,
                notRegisteredEthVaultId,
                config.registerKeys.vaultId.erc20,
                this.outputGuardHandlerRegistry.address,
                this.spendingConditionRegistry.address,
                this.stateTransitionVerifier.address,
                this.txVerifier.address,
                config.registerKeys.txTypes.payment,
            ),
            'Invalid ETH vault',
        );
    });

    it('should fail when being deployed with unset ERC20 vault', async () => {
        const notRegisteredErc20VaultId = config.registerKeys.vaultId.erc20 + 10;
        await expectRevert(
            PaymentInFlightExitRouter.new(
                this.plasmaFramework.address,
                config.registerKeys.vaultId.eth,
                notRegisteredErc20VaultId,
                this.outputGuardHandlerRegistry.address,
                this.spendingConditionRegistry.address,
                this.stateTransitionVerifier.address,
                this.txVerifier.address,
                config.registerKeys.txTypes.payment,
            ),
            'Invalid ERC20 vault',
        );
    });
});
