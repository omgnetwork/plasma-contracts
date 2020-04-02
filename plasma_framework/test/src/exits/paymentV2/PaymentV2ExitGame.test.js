const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');
const PaymentExitGame = artifacts.require('PaymentV2ExitGame');
const PaymentChallengeStandardExit = artifacts.require('PaymentV2ChallengeStandardExit');
const PaymentProcessStandardExit = artifacts.require('PaymentV2ProcessStandardExit');
const PaymentStartStandardExit = artifacts.require('PaymentV2StartStandardExit');
const PaymentStartInFlightExit = artifacts.require('PaymentV2StartInFlightExit');
const PaymentPiggybackInFlightExit = artifacts.require('PaymentV2PiggybackInFlightExit');
const PaymentChallengeIFENotCanonical = artifacts.require('PaymentV2ChallengeIFENotCanonical');
const PaymentChallengeIFEInputSpent = artifacts.require('PaymentV2ChallengeIFEInputSpent');
const PaymentChallengeIFEOutputSpent = artifacts.require('PaymentV2ChallengeIFEOutputSpent');
const PaymentDeleteInFlightExit = artifacts.require('PaymentV2DeleteInFlightExit');
const PaymentProcessInFlightExit = artifacts.require('PaymentV2ProcessInFlightExit');

const { expectRevert, constants } = require('openzeppelin-test-helpers');

const { VAULT_ID, TX_TYPE, SAFE_GAS_STIPEND } = require('../../../helpers/constants.js');

contract('PaymentV2ExitGame', () => {
    const MIN_EXIT_PERIOD = 1000;
    const INITIAL_IMMUNE_VAULTS_NUM = 1;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const DUMMY_STATE_TRANSITION_VERIFIER = constants.ZERO_ADDRESS;

    before('deploy and link with controller lib', async () => {
        const startStandardExit = await PaymentStartStandardExit.new();
        const challengeStandardExit = await PaymentChallengeStandardExit.new();
        const processStandardExit = await PaymentProcessStandardExit.new();

        await PaymentExitGame.link('PaymentV2StartStandardExit', startStandardExit.address);
        await PaymentExitGame.link('PaymentV2ChallengeStandardExit', challengeStandardExit.address);
        await PaymentExitGame.link('PaymentV2ProcessStandardExit', processStandardExit.address);

        const startInFlightExit = await PaymentStartInFlightExit.new();
        const piggybackInFlightExit = await PaymentPiggybackInFlightExit.new();
        const challengeInFlightExitNotCanonical = await PaymentChallengeIFENotCanonical.new();
        const challengeIFEInputSpent = await PaymentChallengeIFEInputSpent.new();
        const challengeIFEOutputSpent = await PaymentChallengeIFEOutputSpent.new();
        const deleteInFlightExit = await PaymentDeleteInFlightExit.new();
        const processInFlightExit = await PaymentProcessInFlightExit.new();

        await PaymentExitGame.link('PaymentV2StartInFlightExit', startInFlightExit.address);
        await PaymentExitGame.link('PaymentV2PiggybackInFlightExit', piggybackInFlightExit.address);
        await PaymentExitGame.link('PaymentV2ChallengeIFENotCanonical', challengeInFlightExitNotCanonical.address);
        await PaymentExitGame.link('PaymentV2ChallengeIFEInputSpent', challengeIFEInputSpent.address);
        await PaymentExitGame.link('PaymentV2ChallengeIFEOutputSpent', challengeIFEOutputSpent.address);
        await PaymentExitGame.link('PaymentV2DeleteInFlightExit', deleteInFlightExit.address);
        await PaymentExitGame.link('PaymentV2ProcessInFlightExit', processInFlightExit.address);
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
});
