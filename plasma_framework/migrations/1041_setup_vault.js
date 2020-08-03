/* eslint-disable no-console */
const PlasmaFramework = artifacts.require('PlasmaFramework');
const EthVault = artifacts.require('EthVault');
const Erc20Vault = artifacts.require('Erc20Vault');
const EthDepositVerifier = artifacts.require('EthDepositVerifier');
const Erc20DepositVerifier = artifacts.require('Erc20DepositVerifier');
const FeeExitGame = artifacts.require('FeeExitGame');
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('../config.js');
const pck = require('../package.json');
// const util = require('util');

module.exports = async (
    deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [deployerAddress, maintainerAddress, authorityAddress],
) => {
    const vault = process.env.VAULT || false;
    const plasmaFramework = await PlasmaFramework.deployed();
    const sha = childProcess.execSync('git rev-parse HEAD').toString().trim().substring(0, 7);
    const feeExitGame = FeeExitGame.deployed();
    const ethDepositVerifier = await EthDepositVerifier.deployed();
    const ethVault = await EthVault.deployed();
    const erc20DepositVerifier = await Erc20DepositVerifier.deployed();
    const erc20Vault = await Erc20Vault.deployed();
    const MORE_VP = config.frameworks.protocols.moreVp;
    const PAYMENT_TX_TYPE = config.registerKeys.txTypes.payment;
    const FEE_TX_TYPE = config.registerKeys.txTypes.fee;
    if (vault) {
        // curl -X PUT -H "X-Vault-Token: $(vault print token)" -H "X-Vault-Request: true" -d '{"chain_id":"5777","rpc_url":"http://ganache:8545"}' http://127.0.0.1:8900/v1/immutability-eth-plugin/config
        // const walletName = 'plasma-deployer';
        // curl -X PUT -H "X-Vault-Request: true" -H "X-Vault-Token: $(vault print token)" -d 'null' http://127.0.0.1:8900/v1/immutability-eth-plugin/wallets/`${walletName}`
        // curl -X PUT -H "X-Vault-Request: true" -H "X-Vault-Token: $(vault print token)" -d 'null' http://127.0.0.1:8900/v1/immutability-eth-plugin/wallets/`${walletName}`/accounts
        // {
        //   "request_id": "4141b5c3-3ba7-beeb-64fe-cac2d75a1dc0",
        //   "lease_id": "",
        //   "lease_duration": 0,
        //   "renewable": false,
        //   "data": {
        //     "address": "0xA1296d36980058b1fe2Bb177b733FaC763d8405E",
        //     "blacklist": null,
        //     "index": 0,
        //     "whitelist": null
        //   },
        //   "warnings": null
        // }
        const buildDir = path.resolve(__dirname, '../../MultiSigWallet/build/multisig_instance');
        const gnosisMultisigAddress = fs.readFileSync(buildDir, 'utf8');
        const gnosisMultisigAbi = {
            constant: false,
            inputs: [
                { name: 'destination', type: 'address' },
                { name: 'value', type: 'uint256' },
                { name: 'data', type: 'bytes' },
            ],
            name: 'submitTransaction',
            outputs: [{ name: 'transactionId', type: 'uint256' }],
            payable: false,
            type: 'function',
            signature: '0xc6427474',
        };
        // ethVault.setDepositVerifier
        const setDepositVerifier = web3.eth.abi.encodeFunctionCall(ethVault.abi.find(o => o.name === 'setDepositVerifier'), [ethDepositVerifier.address]);
        const gnosisSetDepositVerifier = web3.eth.abi.encodeFunctionCall(gnosisMultisigAbi, [ethVault.address, 0, setDepositVerifier]);
        await new Promise((resolve, reject) => web3.eth.sendTransaction({ gas: 3000000, to: gnosisMultisigAddress, from: deployerAddress, data: gnosisSetDepositVerifier }, e => (e ? reject(e) : resolve())));
        // plasmaFramework.registerVault
        const registerVault = web3.eth.abi.encodeFunctionCall(plasmaFramework.abi.find(o => o.name === 'registerVault'), [config.registerKeys.vaultId.eth, ethVault.address]);
        const gnosisRegisterVault = web3.eth.abi.encodeFunctionCall(gnosisMultisigAbi, [plasmaFramework.address, 0, registerVault]);
        await new Promise((resolve, reject) => web3.eth.sendTransaction({ gas: 3000000, to: gnosisMultisigAddress, from: deployerAddress, data: gnosisRegisterVault }, e => (e ? reject(e) : resolve())));
        // ERC20 ethVault.setDepositVerifier
        const setERC20DepositVerifier = web3.eth.abi.encodeFunctionCall(erc20Vault.abi.find(o => o.name === 'setDepositVerifier'), [erc20DepositVerifier.address]);
        const gnosisERC20SetDepositVerifier = web3.eth.abi.encodeFunctionCall(gnosisMultisigAbi, [erc20Vault.address, 0, setERC20DepositVerifier]);
        await new Promise((resolve, reject) => web3.eth.sendTransaction({ gas: 3000000, to: gnosisMultisigAddress, from: deployerAddress, data: gnosisERC20SetDepositVerifier }, e => (e ? reject(e) : resolve())));
        // plasmaFramework.registerVault
        const registerERC20Vault = web3.eth.abi.encodeFunctionCall(plasmaFramework.abi.find(o => o.name === 'registerVault'), [config.registerKeys.vaultId.erc20, erc20Vault.address]);
        const gnosisERC20RegisterVault = web3.eth.abi.encodeFunctionCall(gnosisMultisigAbi, [plasmaFramework.address, 0, registerERC20Vault]);
        await new Promise((resolve, reject) => web3.eth.sendTransaction({ gas: 3000000, to: gnosisMultisigAddress, from: deployerAddress, data: gnosisERC20RegisterVault }, e => (e ? reject(e) : resolve())));
        // init payment exit game!
        // await deployer.deploy(FeeExitGame);
        // the below deployment fails because vaults are not registered yet!
        // https://github.com/omgnetwork/plasma-contracts/issues/656
        // await deployer.deploy(PaymentExitGame, paymentExitGameArgs);

        // plasmaFramework.registerExitGame PAYMENT_TX_TYPE
        const registerExitGame = web3.eth.abi.encodeFunctionCall(plasmaFramework.abi.find(o => o.name === 'registerExitGame'), [PAYMENT_TX_TYPE, paymentExitGame.address, MORE_VP]);
        const gnosisRegisterExitGame = web3.eth.abi.encodeFunctionCall(gnosisMultisigAbi, [plasmaFramework.address, 0, registerExitGame]);
        await new Promise((resolve, reject) => web3.eth.sendTransaction({ gas: 3000000, to: gnosisMultisigAddress, from: deployerAddress, data: gnosisRegisterExitGame }, e => (e ? reject(e) : resolve())));
        
        // plasmaFramework.registerExitGame FEE_TX_TYPE
        const registerFeeExitGame = web3.eth.abi.encodeFunctionCall(plasmaFramework.abi.find(o => o.name === 'registerExitGame'), [FEE_TX_TYPE, feeExitGame.address, MORE_VP]);
        const gnosisFeeRegisterExitGame = web3.eth.abi.encodeFunctionCall(gnosisMultisigAbi, [plasmaFramework.address, 0, registerFeeExitGame]);
        await new Promise((resolve, reject) => web3.eth.sendTransaction({ gas: 3000000, to: gnosisMultisigAddress, from: deployerAddress, data: gnosisFeeRegisterExitGame }, e => (e ? reject(e) : resolve())));

        // set version
        const setVersion = web3.eth.abi.encodeFunctionCall(plasmaFramework.abi.find(o => o.name === 'setVersion'), [`${pck.version}+${sha}`]);
        const gnosisSetVersion = web3.eth.abi.encodeFunctionCall(gnosisMultisigAbi, [plasmaFramework.address, 0, setVersion]);
        await new Promise((resolve, reject) => web3.eth.sendTransaction({ gas: 3000000, to: gnosisMultisigAddress, from: deployerAddress, data: gnosisSetVersion }, e => (e ? reject(e) : resolve())));

        // activate child chain via Vault
        //
        // curl -X PUT -H "X-Vault-Request: true" -H "X-Vault-Token: $(vault print token)" -d '{"contract":"0xd185aff7fb18d2045ba766287ca64992fdd79b1e"}' http://127.0.0.1:8900/v1/immutability-eth-plugin/wallets/plasma-deployer/accounts/0x888a65279D4a3A4E3cbA57D5B3Bd3eB0726655a6/plasma/activateChildChain
        //
    }
};
