/* eslint-disable no-console */

const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');

module.exports = async (
    _deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [deployerAddress, maintainerAddress, authorityAddress],
) => {
    const spendingConditionRegistry = await SpendingConditionRegistry.deployed();
    await spendingConditionRegistry.renounceOwnership();
};
