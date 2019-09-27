const EthDepositVerifier = artifacts.require('EthDepositVerifier');
const EthVault = artifacts.require('EthVault');
const PlasmaFramework = artifacts.require('PlasmaFramework');

const { VAULT_ID } = require('./configs/types_and_ids.js');

module.exports = async (deployer) => {
    await deployer.deploy(EthDepositVerifier);
    await deployer.deploy(EthVault, PlasmaFramework.address);

    const ethVault = await EthVault.deployed();
    await ethVault.setDepositVerifier(EthDepositVerifier.address);

    const plasmaFramework = await PlasmaFramework.deployed();
    await plasmaFramework.registerVault(
        VAULT_ID.ETH,
        PlasmaFramework.address,
        { from: global.authorityAddress },
    );
};
