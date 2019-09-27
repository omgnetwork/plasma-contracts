/* eslint-disable no-console */

const PlasmaFramework = artifacts.require('PlasmaFramework');

const { TX_TYPE, VAULT_ID } = require('./configs/types_and_ids.js');

module.exports = async (_) => {
    const plasmaFramework = await PlasmaFramework.deployed();
    const ethVault = await plasmaFramework.vaults(VAULT_ID.ETH);
    const erc20Vault = await plasmaFramework.vaults(VAULT_ID.ERC20);
    const paymentExitGame = await plasmaFramework.exitGames(TX_TYPE.PAYMENT);

    console.log(JSON.stringify({
        plasma_framework: `${PlasmaFramework.address}`.toLowerCase(),
        eth_vault: `${ethVault}`.toLowerCase(),
        erc20_vault: `${erc20Vault}`.toLowerCase(),
        payment_exit_game: `${paymentExitGame}`.toLowerCase(),
    }));
};
