const EthDepositVerifier = artifacts.require('EthDepositVerifier');
const EthVault = artifacts.require('EthVault');
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
        EthDepositVerifier,
        config.registerKeys.txTypes.payment,
        config.registerKeys.outputTypes.payment,
    );
    const ethDepositVerifier = await EthDepositVerifier.deployed();

    await deployer.deploy(
        EthVault,
        plasmaFramework.address,
        config.frameworks.safeGasStipend.v1,
    );

    const ethVault = await EthVault.deployed();
    // await ethVault.setDepositVerifier(ethDepositVerifier.address, { from: maintainerAddress });

    // await plasmaFramework.registerVault(
    //     config.registerKeys.vaultId.eth,
    //     ethVault.address,
    //     { from: maintainerAddress },
    // );
};
