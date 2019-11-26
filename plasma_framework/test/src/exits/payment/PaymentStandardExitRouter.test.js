const PlasmaFramework = artifacts.require('PlasmaFramework');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const OutputGuardHandlerRegistry = artifacts.require('OutputGuardHandlerRegistry');
const TxFinalizationVerifier = artifacts.require('TxFinalizationVerifier');
const PaymentStandardExitRouter = artifacts.require('PaymentStandardExitRouterMock');
const PaymentChallengeStandardExit = artifacts.require('PaymentChallengeStandardExit');
const PaymentProcessStandardExit = artifacts.require('PaymentProcessStandardExit');
const PaymentStartStandardExit = artifacts.require('PaymentStartStandardExit');

const { expectRevert } = require('openzeppelin-test-helpers');

const config = require('../../../../config.js');

contract('PaymentStandardExitRouter', () => {
    before('get deployed contracts and link libraries', async () => {
        this.plasmaFramework = await PlasmaFramework.deployed();
        this.outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.deployed();
        this.spendingConditionRegistry = await SpendingConditionRegistry.deployed();
        this.txVerifier = await TxFinalizationVerifier.deployed();

        const startStandardExit = await PaymentStartStandardExit.new();
        const challengeStandardExit = await PaymentChallengeStandardExit.new();
        const processStandardExit = await PaymentProcessStandardExit.new();

        await PaymentStandardExitRouter.link('PaymentStartStandardExit', startStandardExit.address);
        await PaymentStandardExitRouter.link('PaymentChallengeStandardExit', challengeStandardExit.address);
        await PaymentStandardExitRouter.link('PaymentProcessStandardExit', processStandardExit.address);
    });

    it('should fail when being deployed with unset ETH vault', async () => {
        const notRegisteredEthVaultId = config.registerKeys.vaultId.eth + 10;
        await expectRevert(
            PaymentStandardExitRouter.new(
                this.plasmaFramework.address,
                notRegisteredEthVaultId,
                config.registerKeys.vaultId.erc20,
                this.outputGuardHandlerRegistry.address,
                this.spendingConditionRegistry.address,
                this.txVerifier.address,
            ),
            'Invalid ETH vault',
        );
    });

    it('should fail when being deployed with unset ERC20 vault', async () => {
        const notRegisteredErc20VaultId = config.registerKeys.vaultId.erc20 + 10;
        await expectRevert(
            PaymentStandardExitRouter.new(
                this.plasmaFramework.address,
                config.registerKeys.vaultId.eth,
                notRegisteredErc20VaultId,
                this.outputGuardHandlerRegistry.address,
                this.spendingConditionRegistry.address,
                this.txVerifier.address,
            ),
            'Invalid ERC20 vault',
        );
    });
});
