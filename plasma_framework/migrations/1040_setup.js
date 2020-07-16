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
const LedgerWalletProvider = require('truffle-ledger-provider');
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
        const ledgerOptions = {
            networkId: 1, // mainnet
            path: "44'/60'/0'/0", // ledger default derivation path
            askConfirm: false,
            accountsLength: 1,
            accountsOffset: 0,
        };
        const provider = new LedgerWalletProvider(ledgerOptions, process.env.REMOTE_URL || 'http://127.0.0.1:7545');
        web3.eth.setProvider(provider);
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
        const setDepositVerifier = web3.eth.abi.encodeFunctionCall(ethVault.abi.find(o => o.name === 'setDepositVerifier'), [ethDepositVerifier.address]);
        const gnosisSetDepositVerifier = web3.eth.abi.encodeFunctionCall(gnosisMultisigAbi, [ethVault.address, 0, setDepositVerifier])
        
        // await new Promise((resolve, reject) => web3.eth.sendTransaction({gas: 9000000, to: gnosisMultisigAddress, from: deployer, data: gnosisSetDepositVerifier}, e => (e ? reject(e) : resolve())));

        // web3.eth.sendTransaction({gas: 9000000, to: gnosisMultisigAddress, from: deployer, data: gnosisSetDepositVerifier}).then ((result) => {
        // console.log('what is this?');
        // console.log(result)
        // })
        // .catch ((error) => {
        // console.log('what is this2?');
        // console.error(error);
        // });

        // web3.eth.sendTransaction({gas: 3000000, to: gnosisMultisigAddress, from: deployer, data: gnosisSetDepositVerifier},
        // function (error, transactionHash) {
        //     if (!error) {
        //         console.log("send successfully");
        //     } else {
        //         console.log("Error: " + error);
        //     }
        // });
       
        // console.log(util.inspect(result, {showHidden: false, depth: null}));
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
