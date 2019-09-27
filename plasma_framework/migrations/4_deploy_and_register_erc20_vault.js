const Erc20DepositVerifier = artifacts.require('Erc20DepositVerifier');
const Erc20Vault = artifacts.require('Erc20Vault');
const PlasmaFramework = artifacts.require('PlasmaFramework');

const { VAULT_ID } = require('./configs/types_and_ids.js');

module.exports = async (deployer) => {
    await deployer.deploy(Erc20DepositVerifier);
    await deployer.deploy(Erc20Vault, PlasmaFramework.address);

    const erc20Vault = await Erc20Vault.deployed();
    await erc20Vault.setDepositVerifier(Erc20DepositVerifier.address);

    const plasmaFramework = await PlasmaFramework.deployed();
    await plasmaFramework.registerVault(
        VAULT_ID.ERC20,
        Erc20Vault.address,
        { from: global.authorityAddress },
    );
};
