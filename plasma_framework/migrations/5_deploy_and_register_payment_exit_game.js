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

const { TX_TYPE, OUTPUT_TYPE, VAULT_ID } = require('./configs/types_and_ids.js');
const { PROTOCOL } = require('./configs/framework_variables.js');

module.exports = async (_) => {
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
    const plasmaFramework = await PlasmaFramework.deployed();
    const ethVaultAddress = await plasmaFramework.vaults(VAULT_ID.ETH);
    const erc20VaultAddress = await plasmaFramework.vaults(VAULT_ID.ERC20);
    const paymentExitGame = await PaymentExitGame.new(
        plasmaFramework.address,
        ethVaultAddress,
        erc20VaultAddress,
        outputGuardHandlerRegistry.address,
        spendingConditionRegistry.address,
        stateVerifier.address,
        TX_TYPE.PAYMENT,
    );

    // handle output guard handler
    const paymentOutputGuardHandler = await PaymentOutputGuardHandler.new(OUTPUT_TYPE.PAYMENT);
    await outputGuardHandlerRegistry.registerOutputGuardHandler(
        OUTPUT_TYPE.PAYMENT, paymentOutputGuardHandler.address,
    );
    await outputGuardHandlerRegistry.renounceOwnership();

    // handle spending condition
    const paymentToPaymentCondition = await PaymentOutputToPaymentTxCondition.new(
        plasmaFramework.address, OUTPUT_TYPE.PAYMENT, TX_TYPE.PAYMENT,
    );
    const paymentToPaymentV2Condition = await PaymentOutputToPaymentTxCondition.new(
        plasmaFramework.address, OUTPUT_TYPE.PAYMENT, TX_TYPE.PAYMENT_V2,
    );
    await spendingConditionRegistry.registerSpendingCondition(
        OUTPUT_TYPE.PAYMENT, TX_TYPE.PAYMENT, paymentToPaymentCondition.address,
    );
    await spendingConditionRegistry.registerSpendingCondition(
        OUTPUT_TYPE.PAYMENT, TX_TYPE.PAYMENT_V2, paymentToPaymentV2Condition.address,
    );
    await spendingConditionRegistry.renounceOwnership();

    // register the exit game to framework
    await plasmaFramework.registerExitGame(
        TX_TYPE.PAYMENT,
        paymentExitGame.address,
        PROTOCOL.MORE_VP,
        { from: global.authorityAddress },
    );
};
