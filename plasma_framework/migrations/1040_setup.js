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
    const vault = process.env.VAULT || false;
    // 20_deploy_plasma_framework.js
    const plasmaFramework = await PlasmaFramework.deployed();
    if (vault) {
        await plasmaFramework.activateChildChain({ from: authorityAddress });
    }
    const sha = childProcess.execSync('git rev-parse HEAD').toString().trim().substring(0, 7);
    await plasmaFramework.setVersion(`${pck.version}+${sha}`, { from: maintainerAddress });

    // 30_deploy_and_register_eth_vault.js
    const ethDepositVerifier = await EthDepositVerifier.deployed();
    const ethVault = await EthVault.deployed();
    await ethVault.setDepositVerifier(ethDepositVerifier.address, { from: maintainerAddress });
    await plasmaFramework.registerVault(
        config.registerKeys.vaultId.eth,
        ethVault.address,
        { from: maintainerAddress },
    );

    // 40_deploy_and_register_erc20_vault.js
    const erc20DepositVerifier = await Erc20DepositVerifier.deployed();
    const erc20Vault = await Erc20Vault.deployed();
    await erc20Vault.setDepositVerifier(erc20DepositVerifier.address, { from: maintainerAddress });

    await plasmaFramework.registerVault(
        config.registerKeys.vaultId.erc20,
        erc20Vault.address,
        { from: maintainerAddress },
    );
    const MORE_VP = config.frameworks.protocols.moreVp;
    // 140_payment_exit_game.js
    // register the exit game to framework
    console.log(`Registering payment exit game`);
    const PAYMENT_TX_TYPE = config.registerKeys.txTypes.payment;
    const paymentExitGame = await PaymentExitGame.deployed();
    await plasmaFramework.registerExitGame(
        PAYMENT_TX_TYPE,
        paymentExitGame.address,
        MORE_VP,
        { from: maintainerAddress },
    );
    // 200_fee_exit_game.js
    console.log(`Registering fee exit game`);
    const FEE_TX_TYPE =  config.registerKeys.txTypes.fee;
    const feeExitGame = await FeeExitGame.deployed();
    await plasmaFramework.registerExitGame(
        FEE_TX_TYPE,
        feeExitGame.address,
        MORE_VP,
        { from: maintainerAddress },
    );
};
