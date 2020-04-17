const PlasmaFramework = artifacts.require('PlasmaFramework');

const childProcess = require('child_process');
const config = require('../config.js');
const pck = require('../package.json');

module.exports = async (
    deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [deployerAddress, maintainerAddress, authorityAddress],
) => {
    const isExperiment = process.env.EXPERIMENT || false;
    const initialImmuneExitGames = (isExperiment)
        ? config.experimental.frameworks.initialImmuneExitGames : config.frameworks.initialImmuneExitGames;

    await deployer.deploy(
        PlasmaFramework,
        config.frameworks.minExitPeriod,
        config.frameworks.initialImmuneVaults,
        initialImmuneExitGames,
        authorityAddress,
        maintainerAddress,
    );

    const plasmaFramework = await PlasmaFramework.deployed();
    await plasmaFramework.activateChildChain({ from: authorityAddress });
    const sha = childProcess.execSync('git rev-parse HEAD').toString().trim().substring(0, 7);
    await plasmaFramework.setVersion(`${pck.version}+${sha}`, { from: maintainerAddress });
};
