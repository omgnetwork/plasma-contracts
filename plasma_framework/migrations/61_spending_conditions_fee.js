/* eslint-disable no-console */

const FeeClaimOutputToPaymentTxCondition = artifacts.require('FeeClaimOutputToPaymentTxCondition');
const PlasmaFramework = artifacts.require('PlasmaFramework');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');

const config = require('../config.js');

module.exports = async (
    deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [deployerAddress, maintainerAddress, authorityAddress],
) => {
    const FEE_CLAIM_OUTPUT_TYPE = config.registerKeys.outputTypes.feeClaim;
    const PAYMENT_TX_TYPE = config.registerKeys.txTypes.payment;
    const FEE_TX_TYPE = config.registerKeys.txTypes.fee;

    const spendingConditionRegistry = await SpendingConditionRegistry.deployed();
    const plasmaFramework = await PlasmaFramework.deployed();

    await deployer.deploy(
        FeeClaimOutputToPaymentTxCondition,
        plasmaFramework.address,
        FEE_TX_TYPE,
        FEE_CLAIM_OUTPUT_TYPE,
        PAYMENT_TX_TYPE,
    );
    const feeClaimOutputToPaymentTxCondition = await FeeClaimOutputToPaymentTxCondition.deployed();
    console.log(`Registering feeClaimOutputToPaymentTxCondition (${feeClaimOutputToPaymentTxCondition.address}) to spendingConditionRegistry`);
    await spendingConditionRegistry.registerSpendingCondition(
        FEE_CLAIM_OUTPUT_TYPE, PAYMENT_TX_TYPE, feeClaimOutputToPaymentTxCondition.address,
    );
};
