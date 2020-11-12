/* eslint-disable no-console */
const PlasmaFramework = artifacts.require('PlasmaFramework');
const PaymentExitGame = artifacts.require('PaymentExitGame');
const FeeExitGame = artifacts.require('FeeExitGame');
const EthVault = artifacts.require('EthVault');
const Erc20Vault = artifacts.require('Erc20Vault');
const EthDepositVerifier = artifacts.require('EthDepositVerifier');
const Erc20DepositVerifier = artifacts.require('Erc20DepositVerifier');
const childProcess = require('child_process');
const config = require('../config.js');
const pck = require('../package.json');

module.exports = async (
    deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [deployerAddress, maintainerAddress, authorityAddress],
) => {
    const vault = process.env.VAULT === 'true';
    if (vault === false) {
        console.log('Performing final setup');
        const plasmaFramework = await PlasmaFramework.deployed();
        const sha = childProcess.execSync('git rev-parse HEAD').toString().trim().substring(0, 7);
        const ethDepositVerifier = await EthDepositVerifier.deployed();
        const ethVault = await EthVault.deployed();
        const erc20DepositVerifier = await Erc20DepositVerifier.deployed();
        const erc20Vault = await Erc20Vault.deployed();
        const MORE_VP = config.frameworks.protocols.moreVp;
        const PAYMENT_TX_TYPE = config.registerKeys.txTypes.payment;
        const FEE_TX_TYPE = config.registerKeys.txTypes.fee;
        const paymentExitGame = await PaymentExitGame.deployed();
        const feeExitGame = await FeeExitGame.deployed();

        await ethVault.setDepositVerifier(ethDepositVerifier.address, { from: maintainerAddress });
        await plasmaFramework.registerVault(
            config.registerKeys.vaultId.eth,
            ethVault.address,
            { from: maintainerAddress },
        );
        await erc20Vault.setDepositVerifier(erc20DepositVerifier.address, { from: maintainerAddress });
        await plasmaFramework.registerVault(
            config.registerKeys.vaultId.erc20,
            erc20Vault.address,
            { from: maintainerAddress },
        );
        await paymentExitGame.init({ from: maintainerAddress });
        await plasmaFramework.registerExitGame(
            PAYMENT_TX_TYPE,
            paymentExitGame.address,
            MORE_VP,
            { from: maintainerAddress },
        );
        await plasmaFramework.registerExitGame(
            FEE_TX_TYPE,
            feeExitGame.address,
            MORE_VP,
            { from: maintainerAddress },
        );
        await plasmaFramework.setVersion(`${pck.version}+${sha}`, { from: maintainerAddress });
    }
};
