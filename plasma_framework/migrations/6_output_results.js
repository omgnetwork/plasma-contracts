/* eslint-disable no-console */

const PlasmaFramework = artifacts.require('PlasmaFramework');
const EthVault = artifacts.require('EthVault');
const Erc20Vault = artifacts.require('Erc20Vault');
const PaymentExitGame = artifacts.require('PaymentExitGame');

module.exports = async (_) => {
    console.log(JSON.stringify({
        plasma_framework: `${PlasmaFramework.address}`.toLowerCase(),
        eth_vault: `${EthVault.address}`.toLowerCase(),
        erc20_vault: `${Erc20Vault.address}`.toLowerCase(),
        payment_exit_game: `${PaymentExitGame.address}`.toLowerCase(),
    }));
};
