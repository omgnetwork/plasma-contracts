const PlasmaFramework = artifacts.require('PlasmaFramework');

const config = require('./config.js');

module.exports = async (deployer) => {
    await deployer.deploy(
        PlasmaFramework,
        config.frameworks.minExitPeriod,
        config.frameworks.initialImmuneVaults,
        config.frameworks.initialImmuneExitGames,
        global.authorityAddress,
        global.maintainerAddress,
    );

    const plasmaFramework = await PlasmaFramework.deployed();
    await plasmaFramework.activateChildChain({ from: global.authorityAddress });
};
