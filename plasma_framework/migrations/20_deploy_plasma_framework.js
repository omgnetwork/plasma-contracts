const PlasmaFramework = artifacts.require('PlasmaFramework');
const fs = require('fs');
const config = require('../config.js');

module.exports = async (
    deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [deployerAddress, maintainerAddress, authorityAddress],
) => {
    let authority;
    const vault = process.env.VAULT || false;
    if (vault) {
        authority = fs.readFileSync('vault_authority').toString();
    } else {
        authority = authorityAddress;
    }
    await deployer.deploy(
        PlasmaFramework,
        config.frameworks.minExitPeriod,
        config.frameworks.initialImmuneVaults,
        config.frameworks.initialImmuneExitGames,
        authority,
        maintainerAddress,
    );
};
