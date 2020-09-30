/* eslint-disable no-console */
/* eslint max-len: ["error", { "code": 500 }] */
/* eslint object-curly-newline: ["error", "never"] */
/* eslint-disable no-await-in-loop */
/* eslint-disable object-shorthand */
const PlasmaFramework = artifacts.require('PlasmaFramework');
const PaymentExitGame = artifacts.require('PaymentExitGame');
const FeeExitGame = artifacts.require('FeeExitGame');
const EthVault = artifacts.require('EthVault');
const Erc20Vault = artifacts.require('Erc20Vault');
const EthDepositVerifier = artifacts.require('EthDepositVerifier');
const Erc20DepositVerifier = artifacts.require('Erc20DepositVerifier');
const util = require('util');
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

const waitForReceipt = async (whatLog, transaction) => {
    let transactionReceipt = null;
    while (transactionReceipt === null) { // Waiting expectedBlockTime until the transaction is mined
        transactionReceipt = await web3.eth.getTransactionReceipt(transaction.transactionHash);
        if (transactionReceipt !== null && transactionReceipt.status === true) {
            console.log(`Got a success transaction receipt for ${whatLog}`);
        } else {
            console.log(`Waiting for successful transaction receipt for ${whatLog}`);
            await sleep(expectedBlockTime);
        }
    }
    // let index;
    // const waitFor = 2;
    // for (index = transactionReceipt.blockNumber; index <= transactionReceipt.blockNumber + waitFor; index = await web3.eth.getBlockNumber()) {
    //     await sleep(expectedBlockTime);
    // }
    // console.log(`Continue from block ${index}`);
    // now lets wait a few blocks
    console.log(`Transaction receipt for ${whatLog}: ${util.inspect(transactionReceipt, { showHidden: false, depth: null })}`);
};

const setDepositVerifier = async (whatLog, ethVault, ethDepositVerifier, gnosisMultisigAbi, gnosisMultisigAddress, deployerAddress) => {
    const setDepositVerifierCall = web3.eth.abi.encodeFunctionCall(ethVault.abi.find(o => o.name === 'setDepositVerifier'), [ethDepositVerifier.address]);
    const gnosisSetDepositVerifier = web3.eth.abi.encodeFunctionCall(gnosisMultisigAbi, [ethVault.address, 0, setDepositVerifierCall]);
    const gas = await web3.eth.estimateGas({ to: gnosisMultisigAddress, from: deployerAddress, data: gnosisSetDepositVerifier }) * 2;
    const transaction = await web3.eth.sendTransaction({ gas: gas, to: gnosisMultisigAddress, from: deployerAddress, data: gnosisSetDepositVerifier });
    console.log(`Submitted transaction with hash for ${whatLog}: ${transaction.transactionHash}`);
    await waitForReceipt(whatLog, transaction);
};

const registerVault = async (whatLog, plasmaFramework, ethVault, key, gnosisMultisigAbi, gnosisMultisigAddress, deployerAddress) => {
    const registerVaultCall = web3.eth.abi.encodeFunctionCall(plasmaFramework.abi.find(o => o.name === 'registerVault'), [key, ethVault.address]);
    const gnosisRegisterVault = web3.eth.abi.encodeFunctionCall(gnosisMultisigAbi, [plasmaFramework.address, 0, registerVaultCall]);
    const gas = await web3.eth.estimateGas({ to: gnosisMultisigAddress, from: deployerAddress, data: gnosisRegisterVault });
    const transaction = await web3.eth.sendTransaction({ gas: gas, to: gnosisMultisigAddress, from: deployerAddress, data: gnosisRegisterVault });
    console.log(`Submitted transaction with hash for ${whatLog}: ${transaction.transactionHash}`);
    await waitForReceipt(whatLog, transaction);
};

const paymentExitGameInit = async (whatLog, paymentExitGame, gnosisMultisigAbi, gnosisMultisigAddress, deployerAddress) => {
    const paymentExitGameInitCall = web3.eth.abi.encodeFunctionCall(paymentExitGame.abi.find(o => o.name === 'init'), []);
    const gnosisPaymentExitGameInit = web3.eth.abi.encodeFunctionCall(gnosisMultisigAbi, [paymentExitGame.address, 0, paymentExitGameInitCall]);
    const gas = await web3.eth.estimateGas({ to: gnosisMultisigAddress, from: deployerAddress, data: gnosisPaymentExitGameInit });
    const transaction = await web3.eth.sendTransaction({ gas: gas, to: gnosisMultisigAddress, from: deployerAddress, data: gnosisPaymentExitGameInit });
    console.log(`Submitted transaction with hash for ${whatLog}: ${transaction.transactionHash}`);
    await waitForReceipt(whatLog, transaction);
};

const registerExitGame = async (whatLog, plasmaFramework, txType, exitGame, id, gnosisMultisigAbi, gnosisMultisigAddress, deployerAddress) => {
    const registerFeeExitGameCall = web3.eth.abi.encodeFunctionCall(plasmaFramework.abi.find(o => o.name === 'registerExitGame'), [txType, exitGame.address, id]);
    const gnosisFeeRegisterExitGame = web3.eth.abi.encodeFunctionCall(gnosisMultisigAbi, [plasmaFramework.address, 0, registerFeeExitGameCall]);
    const gas = await web3.eth.estimateGas({ to: gnosisMultisigAddress, from: deployerAddress, data: gnosisFeeRegisterExitGame });
    const transaction = await web3.eth.sendTransaction({ gas: gas, to: gnosisMultisigAddress, from: deployerAddress, data: gnosisFeeRegisterExitGame });
    console.log(`Submitted transaction with hash for ${whatLog}: ${transaction.transactionHash}`);
    await waitForReceipt(whatLog, transaction);
};

const setVersion = async (whatLog, plasmaFramework, sha, gnosisMultisigAbi, gnosisMultisigAddress, deployerAddress) => {
    const setVersionCall = web3.eth.abi.encodeFunctionCall(plasmaFramework.abi.find(o => o.name === 'setVersion'), [`${pck.version}+${sha}`]);
    const gnosisSetVersion = web3.eth.abi.encodeFunctionCall(gnosisMultisigAbi, [plasmaFramework.address, 0, setVersionCall]);
    const gas = await web3.eth.estimateGas({ to: gnosisMultisigAddress, from: deployerAddress, data: gnosisSetVersion });
    const transaction = await web3.eth.sendTransaction({ gas: gas, to: gnosisMultisigAddress, from: deployerAddress, data: gnosisSetVersion });
    console.log(`Submitted transaction with hash for ${whatLog}: ${transaction.transactionHash}`);
    await waitForReceipt(whatLog, transaction);
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
        const multisigInstance = path.resolve(__dirname, '../../MultiSigWallet/build/multisig_instance');
        const gnosisMultisigAddress = fs.readFileSync(multisigInstance, 'utf8');
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
        await setDepositVerifier('ETH setDepositVerifier', ethVault, ethDepositVerifier, gnosisMultisigAbi, gnosisMultisigAddress, deployerAddress);
        await registerVault('ETH registerVault', plasmaFramework, ethVault, config.registerKeys.vaultId.eth, gnosisMultisigAbi, gnosisMultisigAddress, deployerAddress);
        await setDepositVerifier('ERC20 setDepositVerifier', erc20Vault, erc20DepositVerifier, gnosisMultisigAbi, gnosisMultisigAddress, deployerAddress);
        await registerVault('ERC20 registerVault', plasmaFramework, erc20Vault, config.registerKeys.vaultId.erc20, gnosisMultisigAbi, gnosisMultisigAddress, deployerAddress);
        await paymentExitGameInit('payment exit game init', paymentExitGame, gnosisMultisigAbi, gnosisMultisigAddress, deployerAddress);
        await registerExitGame('registerExitGame PAYMENT_TX_TYPE', plasmaFramework, PAYMENT_TX_TYPE, paymentExitGame, MORE_VP, gnosisMultisigAbi, gnosisMultisigAddress, deployerAddress);
        await registerExitGame('registerExitGame FEE_TX_TYPE', plasmaFramework, FEE_TX_TYPE, feeExitGame, MORE_VP, gnosisMultisigAbi, gnosisMultisigAddress, deployerAddress);
        await setVersion('set Version', plasmaFramework, sha, gnosisMultisigAbi, gnosisMultisigAddress, deployerAddress);
    }
};
