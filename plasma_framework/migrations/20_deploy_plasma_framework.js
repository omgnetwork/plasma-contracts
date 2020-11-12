/* eslint-disable no-console */
const PlasmaFramework = artifacts.require('PlasmaFramework');
const fs = require('fs');
const path = require('path');
const config = require('../config.js');

module.exports = async (
    deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [deployerAddress, maintainerAddress, authorityAddress],
) => {
    let authority;
    let maintainer;
    const vault = process.env.VAULT || false;
    if (vault === true) {
        authority = fs.readFileSync('vault_authority').toString();
        const multisigInstance = path.resolve(__dirname, '../../MultiSigWallet/build/multisig_instance');
        maintainer = fs.readFileSync(multisigInstance, 'utf8');
    } else {
        authority = authorityAddress;
        maintainer = maintainerAddress;
    }
    console.log(`Deploying plasma framework with authority ${authority} and maintainer ${maintainer}`);
    await deployer.deploy(
        PlasmaFramework,
        config.frameworks.minExitPeriod,
        config.frameworks.initialImmuneVaults,
        config.frameworks.initialImmuneExitGames,
        authority,
        maintainer,
    );
};
