/* eslint-disable no-console */
const PlasmaFramework = artifacts.require('PlasmaFramework');
const PaymentExitGame = artifacts.require('PaymentExitGame');
const FeeExitGame = artifacts.require('FeeExitGame');
const EthVault = artifacts.require('EthVault');
const Erc20Vault = artifacts.require('Erc20Vault');
const EthDepositVerifier = artifacts.require('EthDepositVerifier');
const Erc20DepositVerifier = artifacts.require('Erc20DepositVerifier');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const PaymentTransactionStateTransitionVerifier = artifacts.require('PaymentTransactionStateTransitionVerifier');
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('../config.js');
const pck = require('../package.json');
const util = require('util');

module.exports = async (
    deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [deployerAddress, maintainerAddress, authorityAddress],
) => {
    const vault = process.env.VAULT || false;
    const plasmaFramework = await PlasmaFramework.deployed();
    const sha = childProcess.execSync('git rev-parse HEAD').toString().trim().substring(0, 7);
    const ethDepositVerifier = await EthDepositVerifier.deployed();
    const ethVault = await EthVault.deployed();
    const erc20DepositVerifier = await Erc20DepositVerifier.deployed();
    const erc20Vault = await Erc20Vault.deployed();
    const MORE_VP = config.frameworks.protocols.moreVp;
    const PAYMENT_TX_TYPE = config.registerKeys.txTypes.payment;
    const spendingConditionRegistry = await SpendingConditionRegistry.deployed();
    const stateVerifier = await PaymentTransactionStateTransitionVerifier.deployed();
    const paymentExitGameArgs = [
        plasmaFramework.address,
        config.registerKeys.vaultId.eth,
        config.registerKeys.vaultId.erc20,
        spendingConditionRegistry.address,
        stateVerifier.address,
        PAYMENT_TX_TYPE,
        config.frameworks.safeGasStipend.v1,
    ];
    const FEE_TX_TYPE = config.registerKeys.txTypes.fee;
    if (vault) {
        //web3.setProvider(new web3.providers.HttpProvider('http://localhost:7545'));
        //web3.eth.net.isListening().then(console.log);
        //console.log('me');
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
        const gnosisSetDepositVerifier = web3.eth.abi.encodeFunctionCall(gnosisMultisigAbi, [ethVault.address, 0, setDepositVerifier])
        await new Promise((resolve, reject) => web3.eth.sendTransaction({gas: 3000000, to: gnosisMultisigAddress, from: deployerAddress, data: gnosisSetDepositVerifier}, e => (e ? reject(e) : resolve())));
        // plasmaFramework.registerVault
        const registerVault = web3.eth.abi.encodeFunctionCall(plasmaFramework.abi.find(o => o.name === 'registerVault'), [config.registerKeys.vaultId.eth, ethVault.address]);
        const gnosisRegisterVault = web3.eth.abi.encodeFunctionCall(gnosisMultisigAbi, [plasmaFramework.address, 0, registerVault])
        await new Promise((resolve, reject) => web3.eth.sendTransaction({gas: 3000000, to: gnosisMultisigAddress, from: deployerAddress, data: gnosisRegisterVault}, e => (e ? reject(e) : resolve())));

        // ERC20 ethVault.setDepositVerifier
        const setERC20DepositVerifier = web3.eth.abi.encodeFunctionCall(erc20Vault.abi.find(o => o.name === 'setDepositVerifier'), [erc20DepositVerifier.address]);
        const gnosisERC20SetDepositVerifier = web3.eth.abi.encodeFunctionCall(gnosisMultisigAbi, [erc20Vault.address, 0, setERC20DepositVerifier])
        await new Promise((resolve, reject) => web3.eth.sendTransaction({gas: 3000000, to: gnosisMultisigAddress, from: deployerAddress, data: gnosisERC20SetDepositVerifier}, e => (e ? reject(e) : resolve())));
        // plasmaFramework.registerVault
        const registerERC20Vault = web3.eth.abi.encodeFunctionCall(plasmaFramework.abi.find(o => o.name === 'registerVault'), [config.registerKeys.vaultId.erc20, erc20Vault.address]);
        const gnosisERC20RegisterVault = web3.eth.abi.encodeFunctionCall(gnosisMultisigAbi, [plasmaFramework.address, 0, registerERC20Vault])
        await new Promise((resolve, reject) => web3.eth.sendTransaction({gas: 3000000, to: gnosisMultisigAddress, from: deployerAddress, data: gnosisERC20RegisterVault}, e => (e ? reject(e) : resolve())));
        await deployer.deploy(FeeExitGame);
        // the below deployment fails because vaults are not registed yet!
        // https://github.com/omgnetwork/plasma-contracts/issues/656
        await deployer.deploy(PaymentExitGame, paymentExitGameArgs);
        
    } else {
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
        await deployer.deploy(PaymentExitGame, paymentExitGameArgs);
        await deployer.deploy(FeeExitGame);
        const paymentExitGame = await PaymentExitGame.deployed();
        const feeExitGame = await FeeExitGame.deployed();
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
        await plasmaFramework.activateChildChain({ from: authorityAddress });
    }
};
