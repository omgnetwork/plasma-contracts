const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');
const PaymentInFlightExitRouter = artifacts.require('PaymentV2InFlightExitRouterMock');
const PaymentStartInFlightExit = artifacts.require('PaymentV2StartInFlightExit');
const PaymentPiggybackInFlightExit = artifacts.require('PaymentV2PiggybackInFlightExit');
const PaymentChallengeIFENotCanonical = artifacts.require('PaymentV2ChallengeIFENotCanonical');
const PaymentChallengeIFEInputSpent = artifacts.require('PaymentV2ChallengeIFEInputSpent');
const PaymentChallengeIFEOutputSpent = artifacts.require('PaymentV2ChallengeIFEOutputSpent');
const PaymentDeleteInFlightExit = artifacts.require('PaymentV2DeleteInFlightExit');
const PaymentProcessInFlightExit = artifacts.require('PaymentV2ProcessInFlightExit');

const { expectRevert, constants } = require('openzeppelin-test-helpers');

const { TX_TYPE, SAFE_GAS_STIPEND, VAULT_ID } = require('../../../helpers/constants.js');

contract('PaymentV2InFlightExitRouter', () => {
    const MIN_EXIT_PERIOD = 1000;
    const INITIAL_IMMUNE_VAULTS_NUM = 1;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const DUMMY_SPENDING_CONDITION_REGISTRY = constants.ZERO_ADDRESS;
    const DUMMY_STATE_TRANSITION_VERIFIER = constants.ZERO_ADDRESS;

    before('deploy and link with controller lib', async () => {
        const startInFlightExit = await PaymentStartInFlightExit.new();
        const piggybackInFlightExit = await PaymentPiggybackInFlightExit.new();
        const challengeInFlightExitNotCanonical = await PaymentChallengeIFENotCanonical.new();
        const challengeIFEInputSpent = await PaymentChallengeIFEInputSpent.new();
        const challengeIFEOutputSpent = await PaymentChallengeIFEOutputSpent.new();
        const deleteInFlightExit = await PaymentDeleteInFlightExit.new();
        const processInFlightExit = await PaymentProcessInFlightExit.new();

        await PaymentInFlightExitRouter.link('PaymentV2StartInFlightExit', startInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentV2PiggybackInFlightExit', piggybackInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentV2ChallengeIFENotCanonical', challengeInFlightExitNotCanonical.address);
        await PaymentInFlightExitRouter.link('PaymentV2ChallengeIFEInputSpent', challengeIFEInputSpent.address);
        await PaymentInFlightExitRouter.link('PaymentV2ChallengeIFEOutputSpent', challengeIFEOutputSpent.address);
        await PaymentInFlightExitRouter.link('PaymentV2DeleteInFlightExit', deleteInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentV2ProcessInFlightExit', processInFlightExit.address);
    });

    beforeEach('prepare contracts', async () => {
        this.framework = await SpyPlasmaFramework.new(
            MIN_EXIT_PERIOD, INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
        );
        this.ethVault = await SpyEthVault.new(this.framework.address);
        this.erc20Vault = await SpyErc20Vault.new(this.framework.address);
    });

    it('should fail when being deployed with unset ETH vault', async () => {
        await this.framework.registerVault(VAULT_ID.ERC20, this.erc20Vault.address);
        const exitGameArgs = [
            this.framework.address,
            VAULT_ID.ETH,
            VAULT_ID.ERC20,
            DUMMY_SPENDING_CONDITION_REGISTRY,
            DUMMY_STATE_TRANSITION_VERIFIER,
            TX_TYPE.PAYMENT,
            SAFE_GAS_STIPEND,
        ];

        await expectRevert(
            PaymentInFlightExitRouter.new(exitGameArgs),
            'Invalid ETH vault',
        );
    });

    it('should fail when being deployed with unset ERC20 vault', async () => {
        await this.framework.registerVault(VAULT_ID.ETH, this.ethVault.address);
        const exitGameArgs = [
            this.framework.address,
            VAULT_ID.ETH,
            VAULT_ID.ERC20,
            DUMMY_SPENDING_CONDITION_REGISTRY,
            DUMMY_STATE_TRANSITION_VERIFIER,
            TX_TYPE.PAYMENT,
            SAFE_GAS_STIPEND,
        ];

        await expectRevert(
            PaymentInFlightExitRouter.new(exitGameArgs),
            'Invalid ERC20 vault',
        );
    });
});
