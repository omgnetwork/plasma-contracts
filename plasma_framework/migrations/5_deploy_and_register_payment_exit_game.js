const EthVault = artifacts.require('EthVault');
const Erc20Vault = artifacts.require('Erc20Vault');
const OutputGuardHandlerRegistry = artifacts.require('OutputGuardHandlerRegistry');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const PaymentExitGame = artifacts.require('PaymentExitGame');
const PaymentChallengeStandardExit = artifacts.require('PaymentChallengeStandardExit');
const PaymentChallengeIFENotCanonical = artifacts.require('PaymentChallengeIFENotCanonical');
const PaymentChallengeIFEInputSpent = artifacts.require('PaymentChallengeIFEInputSpent');
const PaymentChallengeIFEOutputSpent = artifacts.require('PaymentChallengeIFEOutputSpent');
const PaymentOutputGuardHandler = artifacts.require('PaymentOutputGuardHandler');
const PaymentOutputToPaymentTxCondition = artifacts.require('PaymentOutputToPaymentTxCondition');
const PaymentStartInFlightExit = artifacts.require('PaymentStartInFlightExit');
const PaymentStartStandardExit = artifacts.require('PaymentStartStandardExit');
const PaymentTransactionStateTransitionVerifier = artifacts.require('PaymentTransactionStateTransitionVerifier');
const PaymentPiggybackInFlightExit = artifacts.require('PaymentPiggybackInFlightExit');
const PaymentProcessStandardExit = artifacts.require('PaymentProcessStandardExit');
const PaymentProcessInFlightExit = artifacts.require('PaymentProcessInFlightExit');
const PlasmaFramework = artifacts.require('PlasmaFramework');

module.exports = async (deployer) => {
    const PAYMENT_TX_TYPE = 1;
    const PAYMENT_OUTPUT_TYPE = 1;
    const MORE_VP_PROTOCOL = 2;

    await deployer.deploy(PaymentChallengeStandardExit);
    await deployer.deploy(PaymentChallengeIFENotCanonical);
    await deployer.deploy(PaymentChallengeIFEInputSpent);
    await deployer.deploy(PaymentChallengeIFEOutputSpent);
    await deployer.deploy(PaymentStartInFlightExit);
    await deployer.deploy(PaymentStartStandardExit);
    await deployer.deploy(PaymentPiggybackInFlightExit);
    await deployer.deploy(PaymentProcessStandardExit);
    await deployer.deploy(PaymentProcessInFlightExit);

    await deployer.link(PaymentChallengeStandardExit, PaymentExitGame);
    await deployer.link(PaymentChallengeIFENotCanonical, PaymentExitGame);
    await deployer.link(PaymentChallengeIFEInputSpent, PaymentExitGame);
    await deployer.link(PaymentChallengeIFEOutputSpent, PaymentExitGame);
    await deployer.link(PaymentStartInFlightExit, PaymentExitGame);
    await deployer.link(PaymentStartStandardExit, PaymentExitGame);
    await deployer.link(PaymentPiggybackInFlightExit, PaymentExitGame);
    await deployer.link(PaymentProcessStandardExit, PaymentExitGame);
    await deployer.link(PaymentProcessInFlightExit, PaymentExitGame);

    await deployer.deploy(OutputGuardHandlerRegistry);
    await deployer.deploy(SpendingConditionRegistry);
    await deployer.deploy(PaymentTransactionStateTransitionVerifier);

    await deployer.deploy(
        PaymentExitGame,
        PlasmaFramework.address,
        EthVault.address,
        Erc20Vault.address,
        OutputGuardHandlerRegistry.address,
        SpendingConditionRegistry.address,
        PaymentTransactionStateTransitionVerifier.address,
        PAYMENT_TX_TYPE,
        { gas: 6500000 },
    );

    await deployer.deploy(
        PaymentOutputToPaymentTxCondition,
        PlasmaFramework.address,
        PAYMENT_OUTPUT_TYPE,
        PAYMENT_TX_TYPE,
    );

    await deployer.deploy(PaymentOutputGuardHandler, PAYMENT_OUTPUT_TYPE);
    const outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.deployed();

    await outputGuardHandlerRegistry.registerOutputGuardHandler(
        PAYMENT_OUTPUT_TYPE, PaymentOutputGuardHandler.address,
    );

    // TODO: await outputGuardHandlerRegistry.renounceOwnership();

    const spendingConditionRegistry = await SpendingConditionRegistry.deployed();
    await spendingConditionRegistry.registerSpendingCondition(
        PAYMENT_OUTPUT_TYPE, PAYMENT_TX_TYPE, PaymentOutputToPaymentTxCondition.address,
    );
    await spendingConditionRegistry.renounceOwnership();

    const plasmaFramework = await PlasmaFramework.deployed();
    await plasmaFramework.registerExitGame(
        PAYMENT_TX_TYPE,
        PaymentExitGame.address,
        MORE_VP_PROTOCOL,
        { from: global.authorityAddress },
    );
};
