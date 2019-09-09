const ERC20Mintable = artifacts.require('ERC20Mintable');
const OutputGuardHandlerRegistry = artifacts.require('OutputGuardHandlerRegistry');
const PaymentChallengeStandardExit = artifacts.require('PaymentChallengeStandardExit');
const PaymentProcessStandardExit = artifacts.require('PaymentProcessStandardExit');
const PaymentStandardExitRouter = artifacts.require('PaymentStandardExitRouterMock');
const PaymentSpendingConditionRegistry = artifacts.require('PaymentSpendingConditionRegistry');
const PaymentStartStandardExit = artifacts.require('PaymentStartStandardExit');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');

const {
    BN, constants, expectEvent,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { buildUtxoPos } = require('../../../helpers/positions.js');
const { PROTOCOL } = require('../../../helpers/constants.js');

contract('PaymentStandardExitRouter', ([_, alice]) => {
    const ETH = constants.ZERO_ADDRESS;
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week in seconds
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const EMPTY_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

    before('deploy and link with controller lib', async () => {
        const startStandardExit = await PaymentStartStandardExit.new();
        const challengeStandardExit = await PaymentChallengeStandardExit.new();
        const processStandardExit = await PaymentProcessStandardExit.new();

        await PaymentStandardExitRouter.link('PaymentStartStandardExit', startStandardExit.address);
        await PaymentStandardExitRouter.link('PaymentChallengeStandardExit', challengeStandardExit.address);
        await PaymentStandardExitRouter.link('PaymentProcessStandardExit', processStandardExit.address);
    });

    describe('processStandardExit', () => {
        beforeEach(async () => {
            this.framework = await SpyPlasmaFramework.new(
                MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
            );

            const ethVault = await SpyEthVault.new(this.framework.address);
            const erc20Vault = await SpyErc20Vault.new(this.framework.address);
            const outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();
            const spendingConditionRegistry = await PaymentSpendingConditionRegistry.new();

            this.exitGame = await PaymentStandardExitRouter.new(
                this.framework.address, ethVault.address, erc20Vault.address,
                outputGuardHandlerRegistry.address, spendingConditionRegistry.address,
            );
            this.framework.registerExitGame(1, this.exitGame.address, PROTOCOL.MORE_VP);

            // prepare the bond that should be set when exit starts
            this.startStandardExitBondSize = await this.exitGame.startStandardExitBondSize();
            await this.exitGame.depositFundForTest({ value: this.startStandardExitBondSize });
        });

        const getTestExitData = (exitable, token) => ({
            exitable,
            utxoPos: buildUtxoPos(1, 0, 0),
            outputId: web3.utils.sha3('output id'),
            outputTypeAndGuardHash: web3.utils.sha3('outputTypeAndGuardHash'),
            token,
            exitTarget: alice,
            amount: web3.utils.toWei('3', 'ether'),
            bondSize: this.startStandardExitBondSize.toString(),
        });

        it('should not process the exit when such exit is not exitable', async () => {
            const exitId = 1;
            const exitable = false;
            const testExitData = getTestExitData(exitable, ETH);
            await this.exitGame.setExit(exitId, testExitData);

            const { receipt } = await this.exitGame.processExit(exitId, ETH);

            await expectEvent.inTransaction(
                receipt.transactionHash,
                PaymentProcessStandardExit,
                'ExitOmitted',
                { exitId: new BN(exitId) },
            );
        });

        it('should not process the exit when output already flagged as spent', async () => {
            const exitId = 1;
            const testExitData = getTestExitData(true, ETH);
            await this.exitGame.setExit(exitId, testExitData);
            await this.exitGame.proxyFlagOutputSpent(testExitData.outputId);

            const { receipt } = await this.exitGame.processExit(exitId, ETH);

            await expectEvent.inTransaction(
                receipt.transactionHash,
                PaymentProcessStandardExit,
                'ExitOmitted',
                { exitId: new BN(exitId) },
            );
        });

        it('should flag the output spent when sucessfully processed', async () => {
            const exitId = 1;
            const testExitData = getTestExitData(true, ETH);
            await this.exitGame.setExit(exitId, testExitData);

            await this.exitGame.processExit(exitId, ETH);

            expect(await this.framework.isOutputSpent(testExitData.outputId)).to.be.true;
        });

        it('should return standard exit bond to exit target when the exit token is ETH', async () => {
            const exitId = 1;
            const testExitData = getTestExitData(true, ETH);
            await this.exitGame.setExit(exitId, testExitData);

            const preBalance = new BN(await web3.eth.getBalance(testExitData.exitTarget));
            await this.exitGame.processExit(exitId, ETH);
            const postBalance = new BN(await web3.eth.getBalance(testExitData.exitTarget));
            const expectBalance = preBalance.add(this.startStandardExitBondSize);

            expect(postBalance).to.be.bignumber.equal(expectBalance);
        });

        it('should return standard exit bond to exit target when the exit token is ERC20', async () => {
            const exitId = 1;
            const erc20Token = (await ERC20Mintable.new()).address;
            const testExitData = getTestExitData(true, erc20Token);
            await this.exitGame.setExit(exitId, testExitData);

            const preBalance = new BN(await web3.eth.getBalance(testExitData.exitTarget));
            await this.exitGame.processExit(exitId, ETH);
            const postBalance = new BN(await web3.eth.getBalance(testExitData.exitTarget));
            const expectBalance = preBalance.add(this.startStandardExitBondSize);

            expect(postBalance).to.be.bignumber.equal(expectBalance);
        });

        it('should call the ETH vault with exit amount when the exit token is ETH', async () => {
            const exitId = 1;
            const testExitData = getTestExitData(true, ETH);
            await this.exitGame.setExit(exitId, testExitData);

            const { receipt } = await this.exitGame.processExit(exitId, ETH);
            await expectEvent.inTransaction(
                receipt.transactionHash,
                SpyEthVault,
                'EthWithdrawCalled',
                {
                    target: testExitData.exitTarget,
                    amount: new BN(testExitData.amount),
                },
            );
        });

        it('should call the Erc20 vault with exit amount when the exit token is an ERC 20 token', async () => {
            const exitId = 1;
            const erc20Token = (await ERC20Mintable.new()).address;
            const testExitData = getTestExitData(true, erc20Token);
            await this.exitGame.setExit(exitId, testExitData);

            const { receipt } = await this.exitGame.processExit(exitId, erc20Token);

            await expectEvent.inTransaction(
                receipt.transactionHash,
                SpyErc20Vault,
                'Erc20WithdrawCalled',
                {
                    target: testExitData.exitTarget,
                    token: testExitData.token,
                    amount: new BN(testExitData.amount),
                },
            );
        });

        it('should deletes the standard exit data', async () => {
            const exitId = 1;
            const testExitData = getTestExitData(true, ETH);
            await this.exitGame.setExit(exitId, testExitData);

            await this.exitGame.processExit(exitId, ETH);

            const exitData = await this.exitGame.standardExits(exitId);

            Object.values(exitData).forEach((val) => {
                expect(val).to.be.oneOf([false, '0', EMPTY_BYTES32, constants.ZERO_ADDRESS]);
            });
        });

        it('should emit ExitFinalized event', async () => {
            const exitId = 1;
            const testExitData = getTestExitData(true, ETH);
            await this.exitGame.setExit(exitId, testExitData);

            const { receipt } = await this.exitGame.processExit(exitId, ETH);

            await expectEvent.inTransaction(
                receipt.transactionHash,
                PaymentProcessStandardExit,
                'ExitFinalized',
                { exitId: new BN(exitId) },
            );
        });
    });
});
