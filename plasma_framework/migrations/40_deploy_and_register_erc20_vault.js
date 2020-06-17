const Erc20DepositVerifier = artifacts.require('Erc20DepositVerifier');
const Erc20Vault = artifacts.require('Erc20Vault');
const PlasmaFramework = artifacts.require('PlasmaFramework');

const config = require('../config.js');

module.exports = async (
    deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [deployerAddress, maintainerAddress, authorityAddress],
) => {
    const plasmaFramework = await PlasmaFramework.deployed();

    await deployer.deploy(
        Erc20DepositVerifier,
        config.registerKeys.txTypes.payment,
        config.registerKeys.outputTypes.payment,
    );
    const erc20DepositVerifier = await Erc20DepositVerifier.deployed();

    await deployer.deploy(Erc20Vault, plasmaFramework.address);
    const erc20Vault = await Erc20Vault.deployed();

    await erc20Vault.setDepositVerifier(erc20DepositVerifier.address, { from: maintainerAddress });

    await plasmaFramework.registerVault(
        config.registerKeys.vaultId.erc20,
        erc20Vault.address,
        { from: maintainerAddress },
    );
};
