const PlasmaFramework = artifacts.require('PlasmaFramework');
const PaymentOutputToPaymentTxCondition = artifacts.require('PaymentOutputToPaymentTxCondition');
const PlasmaFramework = artifacts.require('PlasmaFramework');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const PaymentExitGame = artifacts.require('PaymentExitGame');
const FeeExitGame = artifacts.require('FeeExitGame');

const childProcess = require('child_process');
const config = require('../config.js');
const pck = require('../package.json');

module.exports = async (
    deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [deployerAddress, maintainerAddress, authorityAddress],
) => {
    const vault = process.env.VAULT || false;
    //20_deploy_plasma_framework.js
    const plasmaFramework = await PlasmaFramework.deployed();
    if (vault) {
        await plasmaFramework.activateChildChain({ from: authorityAddress });
    }
    const sha = childProcess.execSync('git rev-parse HEAD').toString().trim().substring(0, 7);
    await plasmaFramework.setVersion(`${pck.version}+${sha}`, { from: maintainerAddress });

    //30_deploy_and_register_eth_vault.js
    const ethVault = await EthVault.deployed();
    await ethVault.setDepositVerifier(ethDepositVerifier.address, { from: maintainerAddress });
    await plasmaFramework.registerVault(
        config.registerKeys.vaultId.eth,
        ethVault.address,
        { from: maintainerAddress },
    );

    //40_deploy_and_register_erc20_vault.js
    const erc20Vault = await Erc20Vault.deployed();
    await erc20Vault.setDepositVerifier(erc20DepositVerifier.address, { from: maintainerAddress });

    await plasmaFramework.registerVault(
        config.registerKeys.vaultId.erc20,
        erc20Vault.address,
        { from: maintainerAddress },
    );

    //60_spending_conditions_payment.js
    const PAYMENT_OUTPUT_TYPE = config.registerKeys.outputTypes.payment;
    const PAYMENT_TX_TYPE = config.registerKeys.txTypes.payment;
    const PAYMENT_V2_TX_TYPE = config.registerKeys.txTypes.paymentV2;
    const spendingConditionRegistry = await SpendingConditionRegistry.deployed();

    const paymentToPaymentCondition = await PaymentOutputToPaymentTxCondition.deployed();
    console.log(`Registering paymentToPaymentCondition (${paymentToPaymentCondition.address}) to spendingConditionRegistry`);
    await spendingConditionRegistry.registerSpendingCondition(
        PAYMENT_OUTPUT_TYPE, PAYMENT_TX_TYPE, paymentToPaymentCondition.address,
    );

    const paymentToPaymentV2Condition = await PaymentOutputToPaymentTxCondition.deployed();
    console.log(`Registering paymentToPaymentV2Condition (${paymentToPaymentV2Condition.address}) to spendingConditionRegistry`);
    await spendingConditionRegistry.registerSpendingCondition(
        PAYMENT_OUTPUT_TYPE, PAYMENT_V2_TX_TYPE, paymentToPaymentV2Condition.address,
    );
    //61_spending_conditions_fee.js
    const FEE_CLAIM_OUTPUT_TYPE = config.registerKeys.outputTypes.feeClaim;
    const PAYMENT_TX_TYPE = config.registerKeys.txTypes.payment;
    const feeClaimOutputToPaymentTxCondition = await FeeClaimOutputToPaymentTxCondition.deployed();
    console.log(`Registering feeClaimOutputToPaymentTxCondition (${feeClaimOutputToPaymentTxCondition.address}) to spendingConditionRegistry`);
    await spendingConditionRegistry.registerSpendingCondition(
        FEE_CLAIM_OUTPUT_TYPE, PAYMENT_TX_TYPE, feeClaimOutputToPaymentTxCondition.address,
    );
    //140_payment_exit_game.js
     // register the exit game to framework
     const paymentExitGame = await PaymentExitGame.deployed();
     await plasmaFramework.registerExitGame(
        PAYMENT_TX_TYPE,
        paymentExitGame.address,
        config.frameworks.protocols.moreVp,
        { from: maintainerAddress },
    );
    //200_fee_exit_game.js
    const feeExitGame = await FeeExitGame.deployed();
    
    await plasmaFramework.registerExitGame(
        config.registerKeys.txTypes.fee,
        feeExitGame.address,
        config.frameworks.protocols.moreVp,
        { from: maintainerAddress },
    );
};
