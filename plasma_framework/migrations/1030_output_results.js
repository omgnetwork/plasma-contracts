/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const config = require('../config.js');

const PlasmaFramework = artifacts.require('PlasmaFramework');
const PaymentEip712LibMock = artifacts.require('PaymentEip712LibMock');
const MerkleWrapper = artifacts.require('MerkleWrapper');
const ERC20Mintable = artifacts.require('ERC20Mintable');
module.exports = async (
    deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [deployerAddress, maintainerAddress, authorityAddress],
) => {
    const plasmaFramework = await PlasmaFramework.deployed();
    const ethVault = await plasmaFramework.vaults(config.registerKeys.vaultId.eth);
    const erc20Vault = await plasmaFramework.vaults(config.registerKeys.vaultId.erc20);
    const paymentExitGame = await plasmaFramework.exitGames(config.registerKeys.txTypes.payment);
    const contracts = {
        authority_address: `${authorityAddress}`.toLowerCase(),
        eth_vault: `${ethVault}`.toLowerCase(),
        erc20_vault: `${erc20Vault}`.toLowerCase(),
        payment_exit_game: `${paymentExitGame}`.toLowerCase(),
        plasma_framework_tx_hash: `${PlasmaFramework.network.transactionHash}`.toLowerCase(),
        plasma_framework: `${plasmaFramework.address}`.toLowerCase(),
    };
    // add development contracts if present
    const deployTestContracts = process.env.DEPLOY_TEST_CONTRACTS || false;
    if (deployTestContracts) {
        const paymentEip712LibMock = await PaymentEip712LibMock.deployed();
        contracts.paymentEip712LibMock = `${paymentEip712LibMock.address}`.toLowerCase();
        const merkleWrapper = await MerkleWrapper.deployed();
        contracts.merkleWrapper = `${merkleWrapper.address}`.toLowerCase();
        const erc20Mintable = await ERC20Mintable.deployed();
        contracts.erc20Mintable = `${erc20Mintable.address}`.toLowerCase();
    }
    // make a json
    const data = JSON.stringify(contracts);
    console.log(data);

    // Save to `output.json`
    const buildDir = path.resolve(__dirname, '../build');
    if (!fs.existsSync(buildDir)) {
        fs.mkdirSync(buildDir);
    }
    fs.writeFileSync(path.resolve(buildDir, 'outputs.json'), data);
};
