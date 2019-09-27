const EthDepositVerifier = artifacts.require('EthDepositVerifier');
const EthVault = artifacts.require('EthVault');
const PlasmaFramework = artifacts.require('PlasmaFramework');

const { VAULT_ID } = require('./configs/types_and_ids.js');

module.exports = async (_) => {
    const ethDepositVerifier = await EthDepositVerifier.new();
    const ethVault = await EthVault.new(PlasmaFramework.address, { from: global.authorityAddress });
    await ethVault.setDepositVerifier(ethDepositVerifier.address, { from: global.authorityAddress });

    const plasmaFramework = await PlasmaFramework.deployed();
    await plasmaFramework.registerVault(
        VAULT_ID.ETH,
        ethVault.address,
        { from: global.authorityAddress },
    );
};
