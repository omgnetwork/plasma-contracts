/* eslint-disable no-console */

const PaymentOutputToPaymentTxCondition = artifacts.require('PaymentOutputToPaymentTxCondition');
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
    const PAYMENT_TX_TYPE = config.registerKeys.txTypes.payment;
    const PAYMENT_V2_TX_TYPE = config.registerKeys.txTypes.paymentV2;

    const spendingConditionRegistry = await SpendingConditionRegistry.deployed();
    const plasmaFramework = await PlasmaFramework.deployed();

    await deployer.deploy(
        PaymentOutputToPaymentTxCondition,
        plasmaFramework.address,
        PAYMENT_OUTPUT_TYPE,
        PAYMENT_TX_TYPE,
    );
    const paymentToPaymentCondition = await PaymentOutputToPaymentTxCondition.deployed();
    console.log(`Registering paymentToPaymentCondition (${paymentToPaymentCondition.address}) to spendingConditionRegistry`);
    await spendingConditionRegistry.registerSpendingCondition(
        PAYMENT_OUTPUT_TYPE, PAYMENT_TX_TYPE, paymentToPaymentCondition.address,
    );

    await deployer.deploy(
        PaymentOutputToPaymentTxCondition,
        plasmaFramework.address,
        PAYMENT_OUTPUT_TYPE,
        PAYMENT_V2_TX_TYPE,
    );
    const paymentToPaymentV2Condition = await PaymentOutputToPaymentTxCondition.deployed();
    console.log(`Registering paymentToPaymentV2Condition (${paymentToPaymentV2Condition.address}) to spendingConditionRegistry`);
    await spendingConditionRegistry.registerSpendingCondition(
        PAYMENT_OUTPUT_TYPE, PAYMENT_V2_TX_TYPE, paymentToPaymentV2Condition.address,
    );
};
