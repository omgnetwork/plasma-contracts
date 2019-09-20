const EthDepositVerifier = artifacts.require('EthDepositVerifier');
const EthVault = artifacts.require('EthVault');
const PlasmaFramework = artifacts.require('PlasmaFramework');

module.exports = async (deployer) => {
    await deployer.deploy(EthDepositVerifier);
    await deployer.deploy(EthVault, PlasmaFramework.address);

    const ethVault = await EthVault.deployed();
    await ethVault.setDepositVerifier(EthDepositVerifier.address);
};
