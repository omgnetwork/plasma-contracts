const Quasar = artifacts.require('Quasar');
const PlasmaFramework = artifacts.require('PlasmaFramework');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');

module.exports = async (
    deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [deployerAddress, maintainerAddress, authorityAddress],
) => {
    const deployQuasar = process.env.DEPLOY_QUASAR === 'true';
    if (deployQuasar) {
        let plasmaFrameworkAddress = process.env.PLASMA_FRAMEWORK_ADDRESS || false;
        let spendingConditionRegistryAddress = process.env.SPENDING_CONDITION_REGISTRY || false;
        if (!plasmaFrameworkAddress) {
            const plasmaFramework = await PlasmaFramework.deployed();
            plasmaFrameworkAddress = plasmaFramework.address;
            const spendingConditionRegistry = await SpendingConditionRegistry.deployed();
            spendingConditionRegistryAddress = spendingConditionRegistry.address;
        }
        const quasarOwner = process.env.QUASAR_OWNER;
        const safeBlockMargin = process.env.QUASAR_BLOCK_MARGIN;
        const bondValue = process.env.QUASAR_BOND_VALUE;
        await deployer.deploy(
            Quasar,
            plasmaFrameworkAddress,
            spendingConditionRegistryAddress,
            quasarOwner,
            safeBlockMargin,
            bondValue,
        );
    }
};
