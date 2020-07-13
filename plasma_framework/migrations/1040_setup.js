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
const config = require('../config.js');
const pck = require('../package.json');

module.exports = async (
    deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [deployerAddress, maintainerAddress, authorityAddress],
) => {
    const plasmaFramework = await PlasmaFramework.deployed();
    const sha = childProcess.execSync('git rev-parse HEAD').toString().trim().substring(0, 7);
    await plasmaFramework.setVersion(`${pck.version}+${sha}`, { from: maintainerAddress });

    // ETH vault registeration
    console.log('Register eth vault');
    const ethDepositVerifier = await EthDepositVerifier.deployed();
    const ethVault = await EthVault.deployed();
    await ethVault.setDepositVerifier(ethDepositVerifier.address, { from: maintainerAddress });
    await plasmaFramework.registerVault(
        config.registerKeys.vaultId.eth,
        ethVault.address,
        { from: maintainerAddress },
    );

    // ERC20 vault registeration
    console.log('Register ERC20 vault');
    const erc20DepositVerifier = await Erc20DepositVerifier.deployed();
    const erc20Vault = await Erc20Vault.deployed();
    await erc20Vault.setDepositVerifier(erc20DepositVerifier.address, { from: maintainerAddress });

    await plasmaFramework.registerVault(
        config.registerKeys.vaultId.erc20,
        erc20Vault.address,
        { from: maintainerAddress },
    );
    const MORE_VP = config.frameworks.protocols.moreVp;
    // 140 and 200, vaults need to be registered before we can deploy their exit games
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
    console.log('Deploy PaymentExitGame');
    await deployer.deploy(PaymentExitGame, paymentExitGameArgs);
    await deployer.deploy(FeeExitGame);


    // Register PAYMENT EXIT GAME
    console.log('Registering payment exit game');
    const paymentExitGame = await PaymentExitGame.deployed();
    await plasmaFramework.registerExitGame(
        PAYMENT_TX_TYPE,
        paymentExitGame.address,
        MORE_VP,
        { from: maintainerAddress },
    );
    // Register FEE EXIT GAME
    console.log('Registering fee exit game');
    const FEE_TX_TYPE = config.registerKeys.txTypes.fee;
    const feeExitGame = await FeeExitGame.deployed();
    await plasmaFramework.registerExitGame(
        FEE_TX_TYPE,
        feeExitGame.address,
        MORE_VP,
        { from: maintainerAddress },
    );

    // activate the CHILDCHAIN and DONE
    const vault = process.env.VAULT || false;
    if (vault) {
        console.log('Hey Vaulty thingy.');
    } else {
        await plasmaFramework.activateChildChain({ from: authorityAddress });
    }
    
};
