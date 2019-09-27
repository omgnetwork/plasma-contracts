const Erc20DepositVerifier = artifacts.require('Erc20DepositVerifier');
const Erc20Vault = artifacts.require('Erc20Vault');
const PlasmaFramework = artifacts.require('PlasmaFramework');

const { VAULT_ID } = require('./configs/types_and_ids.js');

module.exports = async (_) => {
    const erc20DepositVerifier = await Erc20DepositVerifier.new();
    const erc20Vault = await Erc20Vault.new(PlasmaFramework.address, { from: global.authorityAddress });
    await erc20Vault.setDepositVerifier(erc20DepositVerifier.address, { from: global.authorityAddress });

    const plasmaFramework = await PlasmaFramework.deployed();
    await plasmaFramework.registerVault(
        VAULT_ID.ERC20,
        erc20Vault.address,
        { from: global.authorityAddress },
    );
};
