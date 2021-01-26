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
    [deployerAddress, _maintainerAddress, authorityAddress],
) => {
    const vault = process.env.VAULT === 'true';
    let authority;
    if (vault) {
        authority = fs.readFileSync('vault_authority').toString();
    } else {
        authority = authorityAddress;
    }
    const plasmaFramework = await PlasmaFramework.deployed();
    const ethVault = await plasmaFramework.vaults(config.registerKeys.vaultId.eth);
    const erc20Vault = await plasmaFramework.vaults(config.registerKeys.vaultId.erc20);
    const paymentExitGame = await plasmaFramework.exitGames(config.registerKeys.txTypes.payment);
    const contracts = {
        authority_address: web3.utils.toChecksumAddress(`${authority}`),
        eth_vault: web3.utils.toChecksumAddress(`${ethVault}`),
        erc20_vault: web3.utils.toChecksumAddress(`${erc20Vault}`),
        payment_exit_game: web3.utils.toChecksumAddress(`${paymentExitGame}`),
        plasma_framework_tx_hash: `${PlasmaFramework.network.transactionHash}`,
        plasma_framework: web3.utils.toChecksumAddress(`${plasmaFramework.address}`),
    };
    // add development contracts if present
    const deployTestContracts = process.env.DEPLOY_TEST_CONTRACTS || false;
    if (deployTestContracts) {
        const paymentEip712LibMock = await PaymentEip712LibMock.deployed();
        contracts.paymentEip712LibMock = web3.utils.toChecksumAddress(`${paymentEip712LibMock.address}`);
        const merkleWrapper = await MerkleWrapper.deployed();
        contracts.merkleWrapper = web3.utils.toChecksumAddress(`${merkleWrapper.address}`);
        const erc20Mintable = await ERC20Mintable.deployed();
        contracts.erc20Mintable = web3.utils.toChecksumAddress(`${erc20Mintable.address}`);
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
