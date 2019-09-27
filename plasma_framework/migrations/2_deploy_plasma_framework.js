const PlasmaFramework = artifacts.require('PlasmaFramework');

const {
    MIN_EXIT_PERIOD, INITIAL_IMMUNE_VAULTS, INITIAL_IMMUNE_EXIT_GAMES,
} = require('./configs/framework_variables.js');

module.exports = async (deployer) => {
    await deployer.deploy(
        PlasmaFramework,
        MIN_EXIT_PERIOD,
        INITIAL_IMMUNE_VAULTS,
        INITIAL_IMMUNE_EXIT_GAMES,
        { from: global.authorityAddress },
    );

    const plasmaFramework = await PlasmaFramework.deployed();
    await plasmaFramework.initAuthority({ from: global.authorityAddress });
};
