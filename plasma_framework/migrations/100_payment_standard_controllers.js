/* eslint-disable no-console */

const PaymentExitGame = artifacts.require('PaymentExitGame');
const PaymentChallengeStandardExit = artifacts.require('PaymentChallengeStandardExit');
const PaymentStartStandardExit = artifacts.require('PaymentStartStandardExit');
const PaymentProcessStandardExit = artifacts.require('PaymentProcessStandardExit');

module.exports = async (
    deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [deployerAddress, maintainerAddress, authorityAddress],
) => {
    // deploy and link standard exit game controllers

    await deployer.deploy(PaymentStartStandardExit);
    const startStandardExit = await PaymentStartStandardExit.deployed();

    await deployer.deploy(PaymentChallengeStandardExit);
    const challengeStandardExit = await PaymentChallengeStandardExit.deployed();

    await deployer.deploy(PaymentProcessStandardExit);
    const processStandardExit = await PaymentProcessStandardExit.deployed();

    await PaymentExitGame.link('PaymentStartStandardExit', startStandardExit.address);
    await PaymentExitGame.link('PaymentChallengeStandardExit', challengeStandardExit.address);
    await PaymentExitGame.link('PaymentProcessStandardExit', processStandardExit.address);
};
