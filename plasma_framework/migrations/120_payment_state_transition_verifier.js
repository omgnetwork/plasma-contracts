/* eslint-disable no-console */

const PaymentTransactionStateTransitionVerifier = artifacts.require('PaymentTransactionStateTransitionVerifier');

module.exports = async (
    deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [deployerAddress, maintainerAddress, authorityAddress],
) => {
    await deployer.deploy(PaymentTransactionStateTransitionVerifier);
};
