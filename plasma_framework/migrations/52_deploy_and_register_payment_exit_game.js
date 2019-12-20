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

    // deploy and link in-flight exit game controllers

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

    await deployer.deploy(PaymentDeleteInFlightExit);
    const deleteInFlightExit = await PaymentDeleteInFlightExit.deployed();

    await deployer.deploy(PaymentProcessInFlightExit);
    const processInFlightExit = await PaymentProcessInFlightExit.deployed();

    await PaymentExitGame.link('PaymentStartInFlightExit', startInFlightExit.address);
    await PaymentExitGame.link('PaymentPiggybackInFlightExit', piggybackInFlightExit.address);
    await PaymentExitGame.link('PaymentChallengeIFENotCanonical', challengeInFlightExitNotCanonical.address);
    await PaymentExitGame.link('PaymentChallengeIFEInputSpent', challengeIFEInputSpent.address);
    await PaymentExitGame.link('PaymentChallengeIFEOutputSpent', challengeIFEOutput.address);
    await PaymentExitGame.link('PaymentDeleteInFlightExit', deleteInFlightExit.address);
    await PaymentExitGame.link('PaymentProcessInFlightExit', processInFlightExit.address);
};
