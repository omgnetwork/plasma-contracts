/* eslint-disable no-console */

const PaymentExitGame = artifacts.require('PaymentExitGame');
const PaymentChallengeIFENotCanonical = artifacts.require('PaymentChallengeIFENotCanonical');
const PaymentChallengeIFEInputSpent = artifacts.require('PaymentChallengeIFEInputSpent');
const PaymentChallengeIFEOutputSpent = artifacts.require('PaymentChallengeIFEOutputSpent');
const PaymentDeleteInFlightExit = artifacts.require('PaymentDeleteInFlightExit');
const PaymentStartInFlightExit = artifacts.require('PaymentStartInFlightExit');
const PaymentPiggybackInFlightExit = artifacts.require('PaymentPiggybackInFlightExit');
const PaymentProcessInFlightExit = artifacts.require('PaymentProcessInFlightExit');

module.exports = async (
    deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [deployerAddress, maintainerAddress, authorityAddress],
) => {
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
