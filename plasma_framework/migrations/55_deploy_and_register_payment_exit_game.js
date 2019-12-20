/* eslint-disable no-console */

const FeeClaimOutputToPaymentTxCondition = artifacts.require('FeeClaimOutputToPaymentTxCondition');
const PaymentExitGame = artifacts.require('PaymentExitGame');
const PaymentChallengeStandardExit = artifacts.require('PaymentChallengeStandardExit');
const PaymentChallengeIFENotCanonical = artifacts.require('PaymentChallengeIFENotCanonical');
const PaymentChallengeIFEInputSpent = artifacts.require('PaymentChallengeIFEInputSpent');
const PaymentChallengeIFEOutputSpent = artifacts.require('PaymentChallengeIFEOutputSpent');
const PaymentDeleteInFlightExit = artifacts.require('PaymentDeleteInFlightExit');
const PaymentOutputToPaymentTxCondition = artifacts.require('PaymentOutputToPaymentTxCondition');
const PaymentStartInFlightExit = artifacts.require('PaymentStartInFlightExit');
const PaymentStartStandardExit = artifacts.require('PaymentStartStandardExit');
const PaymentTransactionStateTransitionVerifier = artifacts.require('PaymentTransactionStateTransitionVerifier');
const PaymentPiggybackInFlightExit = artifacts.require('PaymentPiggybackInFlightExit');
const PaymentProcessStandardExit = artifacts.require('PaymentProcessStandardExit');
const PaymentProcessInFlightExit = artifacts.require('PaymentProcessInFlightExit');
const PlasmaFramework = artifacts.require('PlasmaFramework');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');

const config = require('../config.js');

module.exports = async (
    deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [deployerAddress, maintainerAddress, authorityAddress],
) => {
    const PAYMENT_OUTPUT_TYPE = config.registerKeys.outputTypes.payment;
    const FEE_CLAIM_OUTPUT_TYPE = config.registerKeys.outputTypes.feeClaim;
    const PAYMENT_TX_TYPE = config.registerKeys.txTypes.payment;
    const PAYMENT_V2_TX_TYPE = config.registerKeys.txTypes.paymentV2;
    const FEE_TX_TYPE = config.registerKeys.txTypes.fee;

    const spendingConditionRegistry = await SpendingConditionRegistry.deployed();
    const plasmaFramework = await PlasmaFramework.deployed();

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

    await deployer.deploy(
        FeeClaimOutputToPaymentTxCondition,
        plasmaFramework.address,
        FEE_TX_TYPE,
        FEE_CLAIM_OUTPUT_TYPE,
        PAYMENT_TX_TYPE,
    );
    const feeClaimOutputToPaymentTxCondition = await FeeClaimOutputToPaymentTxCondition.deployed();

    console.log(`Registering paymentToPaymentCondition (${paymentToPaymentCondition.address}) to spendingConditionRegistry`);
    await spendingConditionRegistry.registerSpendingCondition(
        PAYMENT_OUTPUT_TYPE, PAYMENT_TX_TYPE, paymentToPaymentCondition.address,
    );

    console.log(`Registering paymentToPaymentV2Condition (${paymentToPaymentV2Condition.address}) to spendingConditionRegistry`);
    await spendingConditionRegistry.registerSpendingCondition(
        PAYMENT_OUTPUT_TYPE, PAYMENT_V2_TX_TYPE, paymentToPaymentV2Condition.address,
    );

    console.log(`Registering feeClaimOutputToPaymentTxCondition (${feeClaimOutputToPaymentTxCondition.address}) to spendingConditionRegistry`);
    await spendingConditionRegistry.registerSpendingCondition(
        FEE_CLAIM_OUTPUT_TYPE, PAYMENT_TX_TYPE, feeClaimOutputToPaymentTxCondition.address,
    );
    await spendingConditionRegistry.renounceOwnership();
};
