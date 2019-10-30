const OutputGuardHandlerRegistry = artifacts.require('OutputGuardHandlerRegistry');
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
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const TxFinalizationVerifier = artifacts.require('TxFinalizationVerifier');

const config = require('./config.js');

module.exports = async (
    deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [deployerAddress, maintainerAddress, authorityAddress],
) => {
    const PAYMENT_OUTPUT_TYPE = config.registerKeys.outputTypes.payment;
    const PAYMENT_TX_TYPE = config.registerKeys.txTypes.payment;
    const PAYMENT_V2_TX_TYPE = config.registerKeys.txTypes.paymentV2;

    // deploy and link exit game controllers

    await deployer.deploy(PaymentStartStandardExit);
    const startStandardExit = await PaymentStartStandardExit.deployed();

    await deployer.deploy(PaymentChallengeStandardExit);
    const challengeStandardExit = await PaymentChallengeStandardExit.deployed();

    await deployer.deploy(PaymentProcessStandardExit);
    const processStandardExit = await PaymentProcessStandardExit.deployed();

    await deployer.deploy(PaymentStartInFlightExit);
    const startInFlightExit = await PaymentStartInFlightExit.deployed();

    await deployer.deploy(PaymentPiggybackInFlightExit);
    const piggybackInFlightExit = await PaymentPiggybackInFlightExit.deployed();

    await deployer.deploy(PaymentChallengeIFENotCanonical);
    const challengeInFlightExitNotCanonical = await PaymentChallengeIFENotCanonical.deployed();

    await deployer.deploy(PaymentChallengeIFEInputSpent);
    const challengeIFEInputSpent = await PaymentChallengeIFEInputSpent.deployed();

    await deployer.deploy(PaymentChallengeIFEOutputSpent);
    const challengeIFEOutput = await PaymentChallengeIFEOutputSpent.deployed();

    await deployer.deploy(PaymentProcessInFlightExit);
    const processInFlightExit = await PaymentProcessInFlightExit.deployed();

    await PaymentExitGame.link('PaymentStartStandardExit', startStandardExit.address);
    await PaymentExitGame.link('PaymentChallengeStandardExit', challengeStandardExit.address);
    await PaymentExitGame.link('PaymentProcessStandardExit', processStandardExit.address);
    await PaymentExitGame.link('PaymentStartInFlightExit', startInFlightExit.address);
    await PaymentExitGame.link('PaymentPiggybackInFlightExit', piggybackInFlightExit.address);
    await PaymentExitGame.link('PaymentChallengeIFENotCanonical', challengeInFlightExitNotCanonical.address);
    await PaymentExitGame.link('PaymentChallengeIFEInputSpent', challengeIFEInputSpent.address);
    await PaymentExitGame.link('PaymentChallengeIFEOutputSpent', challengeIFEOutput.address);
    await PaymentExitGame.link('PaymentProcessInFlightExit', processInFlightExit.address);

    // deploy exit game

    await deployer.deploy(OutputGuardHandlerRegistry);
    const outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.deployed();

    await deployer.deploy(SpendingConditionRegistry);
    const spendingConditionRegistry = await SpendingConditionRegistry.deployed();

    await deployer.deploy(PaymentTransactionStateTransitionVerifier);
    const stateVerifier = await PaymentTransactionStateTransitionVerifier.deployed();

    await deployer.deploy(TxFinalizationVerifier);
    const txFinalizationVerifier = await TxFinalizationVerifier.deployed();

    const plasmaFramework = await PlasmaFramework.deployed();

    const paymentExitGame = await deployer.deploy(
        PaymentExitGame,
        plasmaFramework.address,
        config.registerKeys.vaultId.eth,
        config.registerKeys.vaultId.erc20,
        outputGuardHandlerRegistry.address,
        spendingConditionRegistry.address,
        stateVerifier.address,
        txFinalizationVerifier.address,
        PAYMENT_TX_TYPE,
    );

    // handle output guard handler
    await deployer.deploy(PaymentOutputGuardHandler, PAYMENT_OUTPUT_TYPE);
    const paymentOutputGuardHandler = await PaymentOutputGuardHandler.deployed();
    await outputGuardHandlerRegistry.registerOutputGuardHandler(
        PAYMENT_OUTPUT_TYPE, paymentOutputGuardHandler.address,
    );
    await outputGuardHandlerRegistry.renounceOwnership();

    // handle spending condition
    await deployer.deploy(
        PaymentOutputToPaymentTxCondition,
        plasmaFramework.address,
        PAYMENT_OUTPUT_TYPE,
        PAYMENT_TX_TYPE,
    );
    const paymentToPaymentCondition = await PaymentOutputToPaymentTxCondition.deployed();

    await deployer.deploy(
        PaymentOutputToPaymentTxCondition,
        plasmaFramework.address,
        PAYMENT_OUTPUT_TYPE,
        PAYMENT_V2_TX_TYPE,
    );
    const paymentToPaymentV2Condition = await PaymentOutputToPaymentTxCondition.deployed();

    await spendingConditionRegistry.registerSpendingCondition(
        PAYMENT_OUTPUT_TYPE, PAYMENT_TX_TYPE, paymentToPaymentCondition.address,
    );
    await spendingConditionRegistry.registerSpendingCondition(
        PAYMENT_OUTPUT_TYPE, PAYMENT_V2_TX_TYPE, paymentToPaymentV2Condition.address,
    );
    await spendingConditionRegistry.renounceOwnership();

    // register the exit game to framework
    await plasmaFramework.registerExitGame(
        PAYMENT_TX_TYPE,
        paymentExitGame.address,
        config.frameworks.protocols.moreVp,
        { from: maintainerAddress },
    );
};
