const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');
const PaymentExitGame = artifacts.require('PaymentExitGame');
const PaymentChallengeStandardExit = artifacts.require('PaymentChallengeStandardExit');
const PaymentProcessStandardExit = artifacts.require('PaymentProcessStandardExit');
const PaymentStartStandardExit = artifacts.require('PaymentStartStandardExit');
const PaymentStartInFlightExit = artifacts.require('PaymentStartInFlightExit');
const PaymentPiggybackInFlightExit = artifacts.require('PaymentPiggybackInFlightExit');
const PaymentChallengeIFENotCanonical = artifacts.require('PaymentChallengeIFENotCanonical');
const PaymentChallengeIFEInputSpent = artifacts.require('PaymentChallengeIFEInputSpent');
const PaymentChallengeIFEOutputSpent = artifacts.require('PaymentChallengeIFEOutputSpent');
const PaymentDeleteInFlightExit = artifacts.require('PaymentDeleteInFlightExit');
const PaymentProcessInFlightExit = artifacts.require('PaymentProcessInFlightExit');

const { expectRevert, constants } = require('openzeppelin-test-helpers');

const { VAULT_ID, TX_TYPE, SAFE_GAS_STIPEND } = require('../../../helpers/constants.js');

contract('PaymentExitGame', ([_, richFather]) => {
    const MIN_EXIT_PERIOD = 1000;
    const INITIAL_IMMUNE_VAULTS_NUM = 1;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const DUMMY_STATE_TRANSITION_VERIFIER = constants.ZERO_ADDRESS;

    before('deploy and link with controller lib', async () => {
        const startStandardExit = await PaymentStartStandardExit.new();
        const challengeStandardExit = await PaymentChallengeStandardExit.new();
        const processStandardExit = await PaymentProcessStandardExit.new();

        await PaymentExitGame.link('PaymentStartStandardExit', startStandardExit.address);
        await PaymentExitGame.link('PaymentChallengeStandardExit', challengeStandardExit.address);
        await PaymentExitGame.link('PaymentProcessStandardExit', processStandardExit.address);

        const startInFlightExit = await PaymentStartInFlightExit.new();
        const piggybackInFlightExit = await PaymentPiggybackInFlightExit.new();
        const challengeInFlightExitNotCanonical = await PaymentChallengeIFENotCanonical.new();
        const challengeIFEInputSpent = await PaymentChallengeIFEInputSpent.new();
        const challengeIFEOutputSpent = await PaymentChallengeIFEOutputSpent.new();
        const deleteInFlightExit = await PaymentDeleteInFlightExit.new();
        const processInFlightExit = await PaymentProcessInFlightExit.new();

        await PaymentExitGame.link('PaymentStartInFlightExit', startInFlightExit.address);
        await PaymentExitGame.link('PaymentPiggybackInFlightExit', piggybackInFlightExit.address);
        await PaymentExitGame.link('PaymentChallengeIFENotCanonical', challengeInFlightExitNotCanonical.address);
        await PaymentExitGame.link('PaymentChallengeIFEInputSpent', challengeIFEInputSpent.address);
        await PaymentExitGame.link('PaymentChallengeIFEOutputSpent', challengeIFEOutputSpent.address);
        await PaymentExitGame.link('PaymentDeleteInFlightExit', deleteInFlightExit.address);
        await PaymentExitGame.link('PaymentProcessInFlightExit', processInFlightExit.address);
    });

    beforeEach('prepare contracts', async () => {
        this.framework = await SpyPlasmaFramework.new(
            MIN_EXIT_PERIOD, INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
        );
        this.ethVault = await SpyEthVault.new(this.framework.address);
        this.erc20Vault = await SpyErc20Vault.new(this.framework.address);
        await this.framework.registerVault(VAULT_ID.ETH, this.ethVault.address);
        await this.framework.registerVault(VAULT_ID.ERC20, this.erc20Vault.address);

        this.spendingConditionRegistry = await SpendingConditionRegistry.new();
    });

    it('should fail to deploy if the spending condition registry has not renounced its ownership', async () => {
        const exitGameArgs = [
            this.framework.address,
            VAULT_ID.ETH,
            VAULT_ID.ERC20,
            this.spendingConditionRegistry.address,
            DUMMY_STATE_TRANSITION_VERIFIER,
            TX_TYPE.PAYMENT,
            SAFE_GAS_STIPEND,
        ];

        await expectRevert(
            PaymentExitGame.new(exitGameArgs),
            'Spending condition registry ownership needs to be renounced',
        );
    });

    it('should fail to init if the caller is not the maintainer', async () => {
        await this.spendingConditionRegistry.renounceOwnership();
        const exitGameArgs = [
            this.framework.address,
            VAULT_ID.ETH,
            VAULT_ID.ERC20,
            this.spendingConditionRegistry.address,
            DUMMY_STATE_TRANSITION_VERIFIER,
            TX_TYPE.PAYMENT,
            SAFE_GAS_STIPEND,
        ];
        const paymentExitGame = await PaymentExitGame.new(exitGameArgs);
        await expectRevert(
            paymentExitGame.init({ from: richFather }),
            'Caller address is unauthorized -- Reason given: Caller address is unauthorized.',
        );
    });

    it('should fail to init twice', async () => {
        await this.spendingConditionRegistry.renounceOwnership();
        const exitGameArgs = [
            this.framework.address,
            VAULT_ID.ETH,
            VAULT_ID.ERC20,
            this.spendingConditionRegistry.address,
            DUMMY_STATE_TRANSITION_VERIFIER,
            TX_TYPE.PAYMENT,
            SAFE_GAS_STIPEND,
        ];
        const paymentExitGame = await PaymentExitGame.new(exitGameArgs);
        await paymentExitGame.init();
        await expectRevert(
            paymentExitGame.init(),
            'Exit game was already initialized.',
        );
    });
});
