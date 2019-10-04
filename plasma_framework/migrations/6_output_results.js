/* eslint-disable no-console */

const PlasmaFramework = artifacts.require('PlasmaFramework');

const config = require('./config.js');

module.exports = async (_) => {
    const plasmaFramework = await PlasmaFramework.deployed();
    const ethVault = await plasmaFramework.vaults(config.registerKeys.vaultId.eth);
    const erc20Vault = await plasmaFramework.vaults(config.registerKeys.vaultId.erc20);
    const paymentExitGame = await plasmaFramework.exitGames(config.registerKeys.txTypes.payment);

    console.log(JSON.stringify({
        plasma_framework_tx_hash: `${PlasmaFramework.network.transactionHash}`.toLowerCase(),
        plasma_framework: `${plasmaFramework.address}`.toLowerCase(),
        eth_vault: `${ethVault}`.toLowerCase(),
        erc20_vault: `${erc20Vault}`.toLowerCase(),
        payment_exit_game: `${paymentExitGame}`.toLowerCase(),
        authority_address: `${global.authorityAddress}`.toLowerCase(),
    }));
};
