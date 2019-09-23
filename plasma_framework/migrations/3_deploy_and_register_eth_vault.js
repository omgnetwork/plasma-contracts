const EthDepositVerifier = artifacts.require('EthDepositVerifier');
const EthVault = artifacts.require('EthVault');
const PlasmaFramework = artifacts.require('PlasmaFramework');

module.exports = async (deployer) => {
    const ETH_VAULT_NUMBER = 1;

    await deployer.deploy(EthDepositVerifier);
    await deployer.deploy(EthVault, PlasmaFramework.address);

    const ethVault = await EthVault.deployed();
    await ethVault.setDepositVerifier(EthDepositVerifier.address);

    const plasmaFramework = await PlasmaFramework.deployed();
    await plasmaFramework.registerVault(
        ETH_VAULT_NUMBER,
        PlasmaFramework.address,
        { from: global.authorityAddress },
    );
};
