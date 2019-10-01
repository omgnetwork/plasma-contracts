const Erc20DepositVerifier = artifacts.require('Erc20DepositVerifier');
const Erc20Vault = artifacts.require('Erc20Vault');
const PlasmaFramework = artifacts.require('PlasmaFramework');

const config = require('./config.js');

module.exports = async (_) => {
    const plasmaFramework = await PlasmaFramework.deployed();

    const erc20DepositVerifier = await Erc20DepositVerifier.new();
    const erc20Vault = await Erc20Vault.new(plasmaFramework.address, { from: global.authorityAddress });
    await erc20Vault.setDepositVerifier(erc20DepositVerifier.address, { from: global.authorityAddress });

    await plasmaFramework.registerVault(
        config.registerKeys.vaultId.erc20,
        erc20Vault.address,
        { from: global.authorityAddress },
    );
};
