const EthDepositVerifier = artifacts.require('EthDepositVerifier');
const EthVault = artifacts.require('EthVault');
const PlasmaFramework = artifacts.require('PlasmaFramework');

const config = require('./config.js');

module.exports = async (
    deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [deployerAddress, maintainerAddress, authorityAddress],
) => {
    const plasmaFramework = await PlasmaFramework.deployed();
    const ethDepositVerifier = await EthDepositVerifier.new();
    const ethVault = await EthVault.new(plasmaFramework.address, { from: maintainerAddress });
    await ethVault.setDepositVerifier(ethDepositVerifier.address, { from: maintainerAddress });

    await plasmaFramework.registerVault(
        config.registerKeys.vaultId.eth,
        ethVault.address,
        { from: maintainerAddress },
    );
};
