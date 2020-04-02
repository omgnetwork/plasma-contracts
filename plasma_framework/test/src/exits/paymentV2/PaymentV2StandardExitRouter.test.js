const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');
const PaymentStandardExitRouter = artifacts.require('PaymentV2StandardExitRouterMock');
const PaymentChallengeStandardExit = artifacts.require('PaymentV2ChallengeStandardExit');
const PaymentProcessStandardExit = artifacts.require('PaymentV2ProcessStandardExit');
const PaymentStartStandardExit = artifacts.require('PaymentV2StartStandardExit');

const { expectRevert, constants } = require('openzeppelin-test-helpers');

const { VAULT_ID, TX_TYPE, SAFE_GAS_STIPEND } = require('../../../helpers/constants.js');

contract('PaymentV2StandardExitRouter', () => {
    const MIN_EXIT_PERIOD = 1000;
    const INITIAL_IMMUNE_VAULTS_NUM = 1;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const DUMMY_SPENDING_CONDITION_REGISTRY = constants.ZERO_ADDRESS;
    const DUMMY_STATE_TRANSITION_VERIFIER = constants.ZERO_ADDRESS;

    before('deploy and link with controller lib', async () => {
        const startStandardExit = await PaymentStartStandardExit.new();
        const challengeStandardExit = await PaymentChallengeStandardExit.new();
        const processStandardExit = await PaymentProcessStandardExit.new();

        await PaymentStandardExitRouter.link('PaymentV2StartStandardExit', startStandardExit.address);
        await PaymentStandardExitRouter.link('PaymentV2ChallengeStandardExit', challengeStandardExit.address);
        await PaymentStandardExitRouter.link('PaymentV2ProcessStandardExit', processStandardExit.address);
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
            PaymentStandardExitRouter.new(exitGameArgs),
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
            PaymentStandardExitRouter.new(exitGameArgs),
            'Invalid ERC20 vault',
        );
    });
});
