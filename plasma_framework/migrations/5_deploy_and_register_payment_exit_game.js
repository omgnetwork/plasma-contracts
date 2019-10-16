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
    const startStandardExit = await PaymentStartStandardExit.new();
    const challengeStandardExit = await PaymentChallengeStandardExit.new();
    const processStandardExit = await PaymentProcessStandardExit.new();
    const startInFlightExit = await PaymentStartInFlightExit.new();
    const piggybackInFlightExit = await PaymentPiggybackInFlightExit.new();
    const challengeInFlightExitNotCanonical = await PaymentChallengeIFENotCanonical.new();
    const challengeIFEInputSpent = await PaymentChallengeIFEInputSpent.new();
    const challengeIFEOutput = await PaymentChallengeIFEOutputSpent.new();
    const processInFlightExit = await PaymentProcessInFlightExit.new();
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
    const outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();
    const spendingConditionRegistry = await SpendingConditionRegistry.new();
    const stateVerifier = await PaymentTransactionStateTransitionVerifier.new();
    const txFinalizationVerifier = await TxFinalizationVerifier.new();
    const plasmaFramework = await PlasmaFramework.deployed();
    const paymentExitGame = await PaymentExitGame.new(
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
    const paymentOutputGuardHandler = await PaymentOutputGuardHandler.new(PAYMENT_OUTPUT_TYPE);
    await outputGuardHandlerRegistry.registerOutputGuardHandler(
        PAYMENT_OUTPUT_TYPE, paymentOutputGuardHandler.address,
    );
    await outputGuardHandlerRegistry.renounceOwnership();

    // handle spending condition
    const paymentToPaymentCondition = await PaymentOutputToPaymentTxCondition.new(
        plasmaFramework.address, PAYMENT_OUTPUT_TYPE, PAYMENT_TX_TYPE,
    );
    const paymentToPaymentV2Condition = await PaymentOutputToPaymentTxCondition.new(
        plasmaFramework.address, PAYMENT_OUTPUT_TYPE, PAYMENT_V2_TX_TYPE,
    );
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
