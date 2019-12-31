/* eslint-disable no-console */

const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');

module.exports = async (
    deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [deployerAddress, maintainerAddress, authorityAddress],
) => {
    await deployer.deploy(SpendingConditionRegistry);
};
