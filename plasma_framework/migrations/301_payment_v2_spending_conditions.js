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
    const isExperiment = process.env.EXPERIMENT || false;
    if (isExperiment) {
        const PAYMENT_OUTPUT_TYPE = config.registerKeys.outputTypes.payment;
        const PAYMENT_V2_OUTPUT_TYPE = config.registerKeys.outputTypes.experimental.paymentV2;
        const PAYMENT_V2_TX_TYPE = config.registerKeys.txTypes.paymentV2;
        const PAYMENT_V3_TX_TYPE = config.registerKeys.txTypes.experimental.paymentV3;

        const spendingConditionRegistry = await SpendingConditionRegistry.deployed();
        const plasmaFramework = await PlasmaFramework.deployed();

        // payment V1 -> payment V2
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

        // payment V2 -> payment V2
        await deployer.deploy(
            PaymentOutputToPaymentTxCondition,
            plasmaFramework.address,
            PAYMENT_V2_OUTPUT_TYPE,
            PAYMENT_V2_TX_TYPE,
        );
        const paymentV2ToPaymentV2Condition = await PaymentOutputToPaymentTxCondition.deployed();
        console.log(`Registering paymentToPaymentCondition (${paymentV2ToPaymentV2Condition.address}) to spendingConditionRegistry`);
        await spendingConditionRegistry.registerSpendingCondition(
            PAYMENT_V2_OUTPUT_TYPE, PAYMENT_V2_TX_TYPE, paymentV2ToPaymentV2Condition.address,
        );

        // payment V2 -> payment V3
        await deployer.deploy(
            PaymentOutputToPaymentTxCondition,
            plasmaFramework.address,
            PAYMENT_V2_OUTPUT_TYPE,
            PAYMENT_V3_TX_TYPE,
        );
        const paymentV2ToPaymentV3Condition = await PaymentOutputToPaymentTxCondition.deployed();
        console.log(`Registering paymentToPaymentV2Condition (${paymentV2ToPaymentV3Condition.address}) to spendingConditionRegistry`);
        await spendingConditionRegistry.registerSpendingCondition(
            PAYMENT_V2_OUTPUT_TYPE, PAYMENT_V3_TX_TYPE, paymentV2ToPaymentV3Condition.address,
        );
    }
};
