/* eslint-disable no-console */
/* eslint max-len: ["error", { "code": 500 }] */
/* eslint object-curly-newline: ["error", "never"] */
/* eslint-disable no-await-in-loop */
/* eslint-disable prefer-arrow-callback */
const PlasmaFramework = artifacts.require('PlasmaFramework');
const PaymentExitGame = artifacts.require('PaymentExitGame');
const FeeExitGame = artifacts.require('FeeExitGame');
const EthVault = artifacts.require('EthVault');
const Erc20Vault = artifacts.require('Erc20Vault');
const EthDepositVerifier = artifacts.require('EthDepositVerifier');
const Erc20DepositVerifier = artifacts.require('Erc20DepositVerifier');
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('../config.js');
const pck = require('../package.json');

const expectedBlockTime = 1000;
/* eslint-disable arrow-body-style */
const sleep = (milliseconds) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
};

module.exports = async (
    deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [deployerAddress, maintainerAddress, authorityAddress],
) => {
    const vault = process.env.VAULT || false;
    if (vault) {
        console.log('Performing final setup with multisig maintainer');
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
        const buildDir = path.resolve(__dirname, '../../MultiSigWallet/build/multisig_instance');
        const gnosisMultisigAddress = fs.readFileSync(buildDir, 'utf8');
        const gnosisMultisigAbi = { constant: false,
            inputs: [
                { name: 'destination', type: 'address' },
                { name: 'value', type: 'uint256' },
                { name: 'data', type: 'bytes' },
            ],
            name: 'submitTransaction',
            outputs: [{ name: 'transactionId', type: 'uint256' }],
            payable: false,
            type: 'function',
            signature: '0xc6427474' };
        // ethVault.setDepositVerifier
        const setDepositVerifier = web3.eth.abi.encodeFunctionCall(ethVault.abi.find(o => o.name === 'setDepositVerifier'), [ethDepositVerifier.address]);
        const gnosisSetDepositVerifier = web3.eth.abi.encodeFunctionCall(gnosisMultisigAbi, [ethVault.address, 0, setDepositVerifier]);
        console.log(await web3.eth.sendTransaction({ gas: 3000000, to: gnosisMultisigAddress, from: deployerAddress, data: gnosisSetDepositVerifier }));
        // web3.eth.sendTransaction({ gas: 3000000, to: gnosisMultisigAddress, from: deployerAddress, data: gnosisSetDepositVerifier }, async function (error, transactonHash) {
        //     console.log(`Submitted transaction with hash: ${transactonHash}`);
        //     let transactionReceipt = null;
        //     while (transactionReceipt == null) { // Waiting expectedBlockTime until the transaction is mined
        //         transactionReceipt = await web3.eth.getTransactionReceipt(transactonHash);
        //         if (transactionReceipt != null) {
        //             console.log(`Got the transaction receipt for ETH setDepositVerifier: ${transactionReceipt}`);
        //         } else {
        //             await sleep(expectedBlockTime);
        //         }
        //     }
        // });
        // plasmaFramework.registerVault
        const registerVault = web3.eth.abi.encodeFunctionCall(plasmaFramework.abi.find(o => o.name === 'registerVault'), [config.registerKeys.vaultId.eth, ethVault.address]);
        const gnosisRegisterVault = web3.eth.abi.encodeFunctionCall(gnosisMultisigAbi, [plasmaFramework.address, 0, registerVault]);
        web3.eth.sendTransaction({ gas: 3000000, to: gnosisMultisigAddress, from: deployerAddress, data: gnosisRegisterVault }, async function (error, transactonHash) {
            console.log(`Submitted transaction with hash: ${transactonHash}`);
            let transactionReceipt = null;
            while (transactionReceipt == null) { // Waiting expectedBlockTime until the transaction is mined
                transactionReceipt = await web3.eth.getTransactionReceipt(transactonHash);
                await sleep(expectedBlockTime);
            }
            console.log(`Got the transaction receipt for ETH registerVault: ${transactionReceipt}`);
        });
        // ERC20 ethVault.setDepositVerifier
        const setERC20DepositVerifier = web3.eth.abi.encodeFunctionCall(erc20Vault.abi.find(o => o.name === 'setDepositVerifier'), [erc20DepositVerifier.address]);
        const gnosisERC20SetDepositVerifier = web3.eth.abi.encodeFunctionCall(gnosisMultisigAbi, [erc20Vault.address, 0, setERC20DepositVerifier]);
        web3.eth.sendTransaction({ gas: 3000000, to: gnosisMultisigAddress, from: deployerAddress, data: gnosisERC20SetDepositVerifier }, async function (error, transactonHash) {
            console.log(`Submitted transaction with hash: ${transactonHash}`);
            let transactionReceipt = null;
            while (transactionReceipt == null) { // Waiting expectedBlockTime until the transaction is mined
                transactionReceipt = await web3.eth.getTransactionReceipt(transactonHash);
                await sleep(expectedBlockTime);
            }
            console.log(`Got the transaction receipt for ERC20 setDepositVerifier: ${transactionReceipt}`);
        });
        // plasmaFramework.registerVault
        const registerERC20Vault = web3.eth.abi.encodeFunctionCall(plasmaFramework.abi.find(o => o.name === 'registerVault'), [config.registerKeys.vaultId.erc20, erc20Vault.address]);
        const gnosisERC20RegisterVault = web3.eth.abi.encodeFunctionCall(gnosisMultisigAbi, [plasmaFramework.address, 0, registerERC20Vault]);
        web3.eth.sendTransaction({ gas: 3000000, to: gnosisMultisigAddress, from: deployerAddress, data: gnosisERC20RegisterVault }, async function (error, transactonHash) {
            console.log(`Submitted transaction with hash: ${transactonHash}`);
            let transactionReceipt = null;
            while (transactionReceipt == null) { // Waiting expectedBlockTime until the transaction is mined
                transactionReceipt = await web3.eth.getTransactionReceipt(transactonHash);
                await sleep(expectedBlockTime);
            }
            console.log(`Got the transaction receipt for ERC20 registerVault: ${transactionReceipt}`);
        });
        // paymentExitGame.init
        const paymentExitGameInit = web3.eth.abi.encodeFunctionCall(paymentExitGame.abi.find(o => o.name === 'init'), []);
        const gnosisPaymentExitGameInit = web3.eth.abi.encodeFunctionCall(gnosisMultisigAbi, [paymentExitGame.address, 0, paymentExitGameInit]);
        web3.eth.sendTransaction({ gas: 3000000, to: gnosisMultisigAddress, from: deployerAddress, data: gnosisPaymentExitGameInit }, async function (error, transactonHash) {
            console.log(`Submitted transaction with hash: ${transactonHash}`);
            let transactionReceipt = null;
            while (transactionReceipt == null) { // Waiting expectedBlockTime until the transaction is mined
                transactionReceipt = await web3.eth.getTransactionReceipt(transactonHash);
                await sleep(expectedBlockTime);
            }
            console.log(`Got the transaction receipt for init: ${transactionReceipt}`);
        });
        // plasmaFramework.registerExitGame PAYMENT_TX_TYPE
        const registerExitGame = web3.eth.abi.encodeFunctionCall(plasmaFramework.abi.find(o => o.name === 'registerExitGame'), [PAYMENT_TX_TYPE, paymentExitGame.address, MORE_VP]);
        const gnosisRegisterExitGame = web3.eth.abi.encodeFunctionCall(gnosisMultisigAbi, [plasmaFramework.address, 0, registerExitGame]);
        web3.eth.sendTransaction({ gas: 3000000, to: gnosisMultisigAddress, from: deployerAddress, data: gnosisRegisterExitGame }, async function (error, transactonHash) {
            console.log(`Submitted transaction with hash: ${transactonHash}`);
            let transactionReceipt = null;
            while (transactionReceipt == null) { // Waiting expectedBlockTime until the transaction is mined
                transactionReceipt = await web3.eth.getTransactionReceipt(transactonHash);
                await sleep(expectedBlockTime);
            }
            console.log(`Got the transaction receipt for registerExitGame: ${transactionReceipt}`);
        });
        // plasmaFramework.registerExitGame FEE_TX_TYPE
        const registerFeeExitGame = web3.eth.abi.encodeFunctionCall(plasmaFramework.abi.find(o => o.name === 'registerExitGame'), [FEE_TX_TYPE, feeExitGame.address, MORE_VP]);
        const gnosisFeeRegisterExitGame = web3.eth.abi.encodeFunctionCall(gnosisMultisigAbi, [plasmaFramework.address, 0, registerFeeExitGame]);
        web3.eth.sendTransaction({ gas: 3000000, to: gnosisMultisigAddress, from: deployerAddress, data: gnosisFeeRegisterExitGame }, async function (error, transactonHash) {
            console.log(`Submitted transaction with hash: ${transactonHash}`);
            let transactionReceipt = null;
            while (transactionReceipt == null) { // Waiting expectedBlockTime until the transaction is mined
                transactionReceipt = await web3.eth.getTransactionReceipt(transactonHash);
                await sleep(expectedBlockTime);
            }
            console.log(`Got the transaction receipt for registerExitGame: ${transactionReceipt}`);
        });
        // set version
        const setVersion = web3.eth.abi.encodeFunctionCall(plasmaFramework.abi.find(o => o.name === 'setVersion'), [`${pck.version}+${sha}`]);
        const gnosisSetVersion = web3.eth.abi.encodeFunctionCall(gnosisMultisigAbi, [plasmaFramework.address, 0, setVersion]);
        web3.eth.sendTransaction({ gas: 3000000, to: gnosisMultisigAddress, from: deployerAddress, data: gnosisSetVersion }, async function (error, transactonHash) {
            console.log(`Submitted transaction with hash: ${transactonHash}`);
            let transactionReceipt = null;
            while (transactionReceipt == null) { // Waiting expectedBlockTime until the transaction is mined
                transactionReceipt = await web3.eth.getTransactionReceipt(transactonHash);
                await sleep(expectedBlockTime);
            }
            console.log(`Got the transaction receipt for setVersion: ${transactionReceipt}`);
        });
    }
};
