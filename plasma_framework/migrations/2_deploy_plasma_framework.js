const PlasmaFramework = artifacts.require('PlasmaFramework');

const config = require('./config.js');

module.exports = async (deployer) => {
    await deployer.deploy(
        PlasmaFramework,
        config.frameworks.minExitPeriod,
        config.frameworks.initialImmuneVaults,
        config.frameworks.initialImmuneExitGames,
        { from: global.authorityAddress },
    );

    const plasmaFramework = await PlasmaFramework.deployed();
    await plasmaFramework.initAuthority({ from: global.authorityAddress });
};
