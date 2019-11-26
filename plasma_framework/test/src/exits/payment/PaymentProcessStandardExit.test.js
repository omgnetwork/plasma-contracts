const ERC20Mintable = artifacts.require('ERC20Mintable');
const OutputGuardHandlerRegistry = artifacts.require('OutputGuardHandlerRegistry');
const PaymentChallengeStandardExit = artifacts.require('PaymentChallengeStandardExit');
const PaymentProcessStandardExit = artifacts.require('PaymentProcessStandardExit');
const PaymentStandardExitRouter = artifacts.require('PaymentStandardExitRouterMock');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const PaymentStartStandardExit = artifacts.require('PaymentStartStandardExit');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');
const StateTransitionVerifierMock = artifacts.require('StateTransitionVerifierMock');
const TxFinalizationVerifier = artifacts.require('TxFinalizationVerifier');
const Attacker = artifacts.require('FallbackFunctionFailAttacker');

const {
    BN, constants, expectEvent,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { buildUtxoPos } = require('../../../helpers/positions.js');
const {
    EMPTY_BYTES_32, PROTOCOL, VAULT_ID, TX_TYPE, SAFE_GAS_STIPEND,
} = require('../../../helpers/constants.js');

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

            await this.framework.registerVault(VAULT_ID.ETH, ethVault.address);
            await this.framework.registerVault(VAULT_ID.ERC20, erc20Vault.address);

            const outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();
            const spendingConditionRegistry = await SpendingConditionRegistry.new();
            const txFinalizationVerifier = await TxFinalizationVerifier.new();
            const stateTransitionVerifier = await StateTransitionVerifierMock.new();

            const exitGameArgs = [
                this.framework.address,
                VAULT_ID.ETH,
                VAULT_ID.ERC20,
                outputGuardHandlerRegistry.address,
                spendingConditionRegistry.address,
                stateTransitionVerifier.address,
                txFinalizationVerifier.address,
                TX_TYPE.PAYMENT,
                SAFE_GAS_STIPEND,
            ];
            this.exitGame = await PaymentStandardExitRouter.new(exitGameArgs);
            this.framework.registerExitGame(1, this.exitGame.address, PROTOCOL.MORE_VP);

            // prepare the bond that should be set when exit starts
            this.startStandardExitBondSize = await this.exitGame.startStandardExitBondSize();
            await this.exitGame.depositFundForTest({ value: this.startStandardExitBondSize });
        });

        const getTestExitData = (exitable, token, exitTarget = alice) => ({
            exitable,
            utxoPos: buildUtxoPos(1, 0, 0),
            outputId: web3.utils.sha3('output id'),
            token,
            exitTarget,
            amount: web3.utils.toWei('3', 'ether'),
            bondSize: this.startStandardExitBondSize.toString(),
        });

        describe('when paying out bond fails', () => {
            beforeEach(async () => {
                const exitId = 1;
                this.attacker = await Attacker.new();

                const testExitData = getTestExitData(true, ETH, this.attacker.address);
                await this.exitGame.setExit(exitId, testExitData);

                this.preBalance = new BN(await web3.eth.getBalance(this.exitGame.address));
                const { receipt } = await this.exitGame.processExit(exitId, VAULT_ID.ETH, ETH);
                this.receiptAfterAttack = receipt;
            });

            it('should not pay out bond', async () => {
                const postBalance = new BN(await web3.eth.getBalance(this.exitGame.address));
                expect(postBalance).to.be.bignumber.equal(this.preBalance);
            });

            it('should publish an event informing that bond pay out failed', async () => {
                await expectEvent.inTransaction(
                    this.receiptAfterAttack.transactionHash,
                    PaymentProcessStandardExit,
                    'BondReturnFailed',
                    {
                        receiver: this.attacker.address,
                        amount: new BN(this.startStandardExitBondSize),
                    },
                );
            });
        });

        it('should not process the exit when such exit is not exitable', async () => {
            const exitId = 1;
            const exitable = false;
            const testExitData = getTestExitData(exitable, ETH);
            await this.exitGame.setExit(exitId, testExitData);

            const { logs } = await this.exitGame.processExit(exitId, VAULT_ID.ETH, ETH);

            await expectEvent.inLogs(
                logs,
                'ExitOmitted',
                { exitId: new BN(exitId) },
            );

            const exitData = (await this.exitGame.standardExits([exitId]))[0];
            Object.values(exitData).forEach((val) => {
                expect(val).to.be.oneOf([false, '0', EMPTY_BYTES_32, constants.ZERO_ADDRESS]);
            });
        });

        it('should not process the exit when output already flagged as spent', async () => {
            const exitId = 1;
            const testExitData = getTestExitData(true, ETH);
            await this.exitGame.setExit(exitId, testExitData);
            await this.exitGame.proxyFlagOutputSpent(testExitData.outputId);

            const { logs } = await this.exitGame.processExit(exitId, VAULT_ID.ETH, ETH);

            await expectEvent.inLogs(
                logs,
                'ExitOmitted',
                { exitId: new BN(exitId) },
            );

            const exitData = (await this.exitGame.standardExits([exitId]))[0];
            Object.values(exitData).forEach((val) => {
                expect(val).to.be.oneOf([false, '0', EMPTY_BYTES_32, constants.ZERO_ADDRESS]);
            });
        });

        it('should flag the output spent when sucessfully processed', async () => {
            const exitId = 1;
            const testExitData = getTestExitData(true, ETH);
            await this.exitGame.setExit(exitId, testExitData);

            await this.exitGame.processExit(exitId, VAULT_ID.ETH, ETH);

            expect(await this.framework.isOutputSpent(testExitData.outputId)).to.be.true;
        });

        it('should return standard exit bond to exit target when the exit token is ETH', async () => {
            const exitId = 1;
            const testExitData = getTestExitData(true, ETH);
            await this.exitGame.setExit(exitId, testExitData);

            const preBalance = new BN(await web3.eth.getBalance(testExitData.exitTarget));
            await this.exitGame.processExit(exitId, VAULT_ID.ETH, ETH);
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
            await this.exitGame.processExit(exitId, VAULT_ID.ETH, ETH);
            const postBalance = new BN(await web3.eth.getBalance(testExitData.exitTarget));
            const expectBalance = preBalance.add(this.startStandardExitBondSize);

            expect(postBalance).to.be.bignumber.equal(expectBalance);
        });

        it('should call the ETH vault with exit amount when the exit token is ETH', async () => {
            const exitId = 1;
            const testExitData = getTestExitData(true, ETH);
            await this.exitGame.setExit(exitId, testExitData);

            const { receipt } = await this.exitGame.processExit(exitId, VAULT_ID.ETH, ETH);
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

            const { receipt } = await this.exitGame.processExit(exitId, VAULT_ID.ERC20, erc20Token);

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

            await this.exitGame.processExit(exitId, VAULT_ID.ETH, ETH);

            const exitData = (await this.exitGame.standardExits([exitId]))[0];
            Object.values(exitData).forEach((val) => {
                expect(val).to.be.oneOf([false, '0', EMPTY_BYTES32, constants.ZERO_ADDRESS]);
            });
        });

        it('should emit ExitFinalized event', async () => {
            const exitId = 1;
            const testExitData = getTestExitData(true, ETH);
            await this.exitGame.setExit(exitId, testExitData);

            const { logs } = await this.exitGame.processExit(exitId, VAULT_ID.ETH, ETH);

            await expectEvent.inLogs(
                logs,
                'ExitFinalized',
                { exitId: new BN(exitId) },
            );
        });
    });
});
