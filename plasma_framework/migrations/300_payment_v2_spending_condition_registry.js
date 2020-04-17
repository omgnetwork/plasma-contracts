/* eslint-disable no-console */

const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');

module.exports = async (
    deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [deployerAddress, maintainerAddress, authorityAddress],
) => {
    const isExperiment = process.env.EXPERIMENT || false;
    if (isExperiment) {
        await deployer.deploy(SpendingConditionRegistry);
    }
};
