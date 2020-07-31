/* eslint-disable no-console */

const PaymentExitGame = artifacts.require('PaymentExitGame');
const PaymentTransactionStateTransitionVerifier = artifacts.require('PaymentTransactionStateTransitionVerifier');
const PlasmaFramework = artifacts.require('PlasmaFramework');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');

const config = require('../config.js');

module.exports = async (
    deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [deployerAddress, maintainerAddress, authorityAddress],
) => {
    const PAYMENT_TX_TYPE = config.registerKeys.txTypes.payment;

    const spendingConditionRegistry = await SpendingConditionRegistry.deployed();
    const stateVerifier = await PaymentTransactionStateTransitionVerifier.deployed();
    const plasmaFramework = await PlasmaFramework.deployed();

    const paymentExitGameArgs = [
        plasmaFramework.address,
        config.registerKeys.vaultId.eth,
        config.registerKeys.vaultId.erc20,
        spendingConditionRegistry.address,
        stateVerifier.address,
        PAYMENT_TX_TYPE,
        config.frameworks.safeGasStipend.v1,
    ];
    await deployer.deploy(PaymentExitGame, paymentExitGameArgs);
    const paymentExitGame = await PaymentExitGame.deployed();
    PaymentExitGame.defaults({ from: maintainerAddress });
    await paymentExitGame.init();
    // register the exit game to framework
    await plasmaFramework.registerExitGame(
        PAYMENT_TX_TYPE,
        paymentExitGame.address,
        config.frameworks.protocols.moreVp,
        { from: maintainerAddress },
    );
};
