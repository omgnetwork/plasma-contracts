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

    // TODO: depends on https://github.com/omisego/plasma-contracts/issues/304#issuecomment-537422072
    // const plasmaFramework = await PlasmaFramework.deployed();
    // await plasmaFramework.initAuthority({ from: global.authorityAddress });
};
