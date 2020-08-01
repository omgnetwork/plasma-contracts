const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');
const PaymentInFlightExitRouter = artifacts.require('PaymentInFlightExitRouterMock');
const PaymentStartInFlightExit = artifacts.require('PaymentStartInFlightExit');
const PaymentPiggybackInFlightExit = artifacts.require('PaymentPiggybackInFlightExit');
const PaymentChallengeIFENotCanonical = artifacts.require('PaymentChallengeIFENotCanonical');
const PaymentChallengeIFEInputSpent = artifacts.require('PaymentChallengeIFEInputSpent');
const PaymentChallengeIFEOutputSpent = artifacts.require('PaymentChallengeIFEOutputSpent');
const PaymentDeleteInFlightExit = artifacts.require('PaymentDeleteInFlightExit');
const PaymentProcessInFlightExit = artifacts.require('PaymentProcessInFlightExit');

const { expectRevert, constants } = require('openzeppelin-test-helpers');

const { TX_TYPE, SAFE_GAS_STIPEND, VAULT_ID } = require('../../../helpers/constants.js');

contract('PaymentInFlightExitRouter', () => {
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

        await PaymentInFlightExitRouter.link('PaymentStartInFlightExit', startInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentPiggybackInFlightExit', piggybackInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFENotCanonical', challengeInFlightExitNotCanonical.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFEInputSpent', challengeIFEInputSpent.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFEOutputSpent', challengeIFEOutputSpent.address);
        await PaymentInFlightExitRouter.link('PaymentDeleteInFlightExit', deleteInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentProcessInFlightExit', processInFlightExit.address);
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
        const paymentInFlightExitRouter = await PaymentInFlightExitRouter.new();
        await expectRevert(
            paymentInFlightExitRouter.boot(exitGameArgs),
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
        const paymentInFlightExitRouter = await PaymentInFlightExitRouter.new();
        await expectRevert(
            paymentInFlightExitRouter.boot(exitGameArgs),
            'Invalid ERC20 vault',
        );
    });
});
