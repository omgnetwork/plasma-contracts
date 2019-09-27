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

const { TX_TYPE, OUTPUT_TYPE } = require('./configs/types_and_ids.js');
const { PROTOCOL } = require('./configs/framework_variables.js');

module.exports = async (deployer) => {
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
        TX_TYPE.PAYMENT,
        { gas: 6500000 },
    );

    await deployer.deploy(
        PaymentOutputToPaymentTxCondition,
        PlasmaFramework.address,
        OUTPUT_TYPE.PAYMENT,
        TX_TYPE.PAYMENT,
    );

    await deployer.deploy(PaymentOutputGuardHandler, OUTPUT_TYPE.PAYMENT);
    const outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.deployed();

    await outputGuardHandlerRegistry.registerOutputGuardHandler(
        OUTPUT_TYPE.PAYMENT, PaymentOutputGuardHandler.address,
    );
    await outputGuardHandlerRegistry.renounceOwnership();

    const spendingConditionRegistry = await SpendingConditionRegistry.deployed();
    await spendingConditionRegistry.registerSpendingCondition(
        OUTPUT_TYPE.PAYMENT, TX_TYPE.PAYMENT, PaymentOutputToPaymentTxCondition.address,
    );
    await spendingConditionRegistry.renounceOwnership();

    const plasmaFramework = await PlasmaFramework.deployed();
    await plasmaFramework.registerExitGame(
        TX_TYPE.PAYMENT,
        PaymentExitGame.address,
        PROTOCOL.MORE_VP,
        { from: global.authorityAddress },
    );
};
