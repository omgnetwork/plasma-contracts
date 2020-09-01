const ERC20Mintable = artifacts.require('ERC20Mintable');
const PaymentChallengeStandardExit = artifacts.require('PaymentChallengeStandardExit');
const PaymentProcessStandardExit = artifacts.require('PaymentProcessStandardExit');
const PaymentStandardExitRouter = artifacts.require('PaymentStandardExitRouterMock');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const PaymentStartStandardExit = artifacts.require('PaymentStartStandardExit');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');
const StateTransitionVerifierMock = artifacts.require('StateTransitionVerifierMock');
const Attacker = artifacts.require('FallbackFunctionFailAttacker');

const { BN, constants, expectEvent } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { buildUtxoPos } = require('../../../../helpers/positions.js');
const {
    PROTOCOL, VAULT_ID, TX_TYPE, SAFE_GAS_STIPEND,
} = require('../../../../helpers/constants.js');
const { spentOnGas } = require('../../../../helpers/utils.js');

contract('PaymentProcessStandardExit', ([_, alice, bob, otherAddress]) => {
    const ETH = constants.ZERO_ADDRESS;
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week in seconds
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const EMPTY_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';
    const EMPTY_EXIT_DATA = [false, '0', EMPTY_BYTES32, ETH, '0', '0', '0'];

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
                MIN_EXIT_PERIOD,
                DUMMY_INITIAL_IMMUNE_VAULTS_NUM,
                INITIAL_IMMUNE_EXIT_GAME_NUM,
            );

            const ethVault = await SpyEthVault.new(this.framework.address);
            const erc20Vault = await SpyErc20Vault.new(this.framework.address);

            await this.framework.registerVault(VAULT_ID.ETH, ethVault.address);
            await this.framework.registerVault(VAULT_ID.ERC20, erc20Vault.address);

            const spendingConditionRegistry = await SpendingConditionRegistry.new();
            const stateTransitionVerifier = await StateTransitionVerifierMock.new();

            const exitGameArgs = [
                this.framework.address,
                VAULT_ID.ETH,
                VAULT_ID.ERC20,
                spendingConditionRegistry.address,
                stateTransitionVerifier.address,
                TX_TYPE.PAYMENT,
                SAFE_GAS_STIPEND,
            ];
            this.exitGame = await PaymentStandardExitRouter.new();
            await this.exitGame.bootInternal(exitGameArgs);
            this.framework.registerExitGame(1, this.exitGame.address, PROTOCOL.MORE_VP);

            // prepare the bond that should be set when exit starts
            this.startStandardExitBondSize = await this.exitGame.startStandardExitBondSize();

            this.processExitBountySize = await this.exitGame.processStandardExitBountySize();

            await this.exitGame.depositFundForTest({
                value: this.startStandardExitBondSize.add(this.processExitBountySize),
            });
        });

        const getTestExitData = (exitable, token, exitTarget = alice) => ({
            exitable,
            utxoPos: buildUtxoPos(1, 0, 0),
            outputId: web3.utils.sha3('output id'),
            token,
            exitTarget,
            amount: web3.utils.toWei('3', 'ether'),
            bondSize: this.startStandardExitBondSize.toString(),
            bountySize: this.processExitBountySize.toString(),
        });

        describe('when paying out bond fails', () => {
            beforeEach(async () => {
                const exitId = 1;
                this.attacker = await Attacker.new();

                const testExitData = getTestExitData(true, ETH, this.attacker.address);
                await this.exitGame.setExit(exitId, testExitData);

                this.preBalance = new BN(await web3.eth.getBalance(this.exitGame.address));
                this.bobBalanceBeforeProcessExit = new BN(await web3.eth.getBalance(bob));
                const { receipt } = await this.exitGame.processExit(exitId, VAULT_ID.ETH, ETH, bob, { from: bob });
                this.receiptAfterAttack = receipt;
            });

            it('should not pay out bond', async () => {
                const postBalance = new BN(await web3.eth.getBalance(this.exitGame.address));
                const expectedBalance = this.preBalance.sub(this.processExitBountySize);
                expect(postBalance).to.be.bignumber.equal(expectedBalance);
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

            it('should still pay out exit bounty', async () => {
                const bobBalanceAfterProcessExit = new BN(await web3.eth.getBalance(bob));
                const expectedBobBalance = this.bobBalanceBeforeProcessExit
                    .add(this.processExitBountySize)
                    .sub(await spentOnGas(this.receiptAfterAttack));
                expect(bobBalanceAfterProcessExit).to.be.bignumber.equal(expectedBobBalance);
            });
        });

        describe('when paying out bounty fails', () => {
            beforeEach(async () => {
                const exitId = 1;
                this.attacker = await Attacker.new();

                const testExitData = getTestExitData(true, ETH, bob);
                await this.exitGame.setExit(exitId, testExitData);

                this.preBalance = new BN(await web3.eth.getBalance(this.exitGame.address));
                this.bobBalanceBeforeProcessExit = new BN(await web3.eth.getBalance(bob));
                const { receipt } = await this.exitGame.processExit(exitId, VAULT_ID.ETH, ETH, this.attacker.address);
                this.receiptAfterAttack = receipt;
            });

            it('should not pay out bounty', async () => {
                const postBalance = new BN(await web3.eth.getBalance(this.exitGame.address));
                const expectedBalance = this.preBalance.sub(this.startStandardExitBondSize);
                expect(postBalance).to.be.bignumber.equal(expectedBalance);
            });

            it('should publish an event informing that bounty pay out failed', async () => {
                await expectEvent.inTransaction(
                    this.receiptAfterAttack.transactionHash,
                    PaymentProcessStandardExit,
                    'BountyReturnFailed',
                    {
                        receiver: this.attacker.address,
                        amount: new BN(this.processExitBountySize),
                    },
                );
            });

            it('should still pay out the bond', async () => {
                const bobBalanceAfterProcessExit = new BN(await web3.eth.getBalance(bob));
                const expectedBobBalance = this.bobBalanceBeforeProcessExit
                    .add(this.startStandardExitBondSize);
                expect(bobBalanceAfterProcessExit).to.be.bignumber.equal(expectedBobBalance);
            });
        });

        it('should not process the exit when such exit is not exitable', async () => {
            const exitId = 1;
            const exitable = false;
            const testExitData = getTestExitData(exitable, ETH);
            await this.exitGame.setExit(exitId, testExitData);

            const { logs } = await this.exitGame.processExit(exitId, VAULT_ID.ETH, ETH, otherAddress);

            await expectEvent.inLogs(logs, 'ExitOmitted', { exitId: new BN(exitId) });

            const exitData = (await this.exitGame.standardExits([exitId]))[0];
            expect(exitData).to.deep.equal(EMPTY_EXIT_DATA);
        });

        it('should not process the exit when output already flagged as spent', async () => {
            const exitId = 1;
            const testExitData = getTestExitData(true, ETH);
            await this.exitGame.setExit(exitId, testExitData);
            await this.exitGame.proxyFlagOutputFinalized(testExitData.outputId, exitId);

            const { logs } = await this.exitGame.processExit(exitId, VAULT_ID.ETH, ETH, otherAddress);

            await expectEvent.inLogs(logs, 'ExitOmitted', { exitId: new BN(exitId) });

            const exitData = (await this.exitGame.standardExits([exitId]))[0];
            expect(exitData).to.deep.equal(EMPTY_EXIT_DATA);
        });

        it('should flag the output spent when sucessfully processed', async () => {
            const exitId = 1;
            const testExitData = getTestExitData(true, ETH);
            await this.exitGame.setExit(exitId, testExitData);

            await this.exitGame.processExit(exitId, VAULT_ID.ETH, ETH, otherAddress);

            expect(await this.framework.isOutputFinalized(testExitData.outputId)).to.be.true;
        });

        it('should return standard exit bond to exit target when the exit token is ETH', async () => {
            const exitId = 1;
            const testExitData = getTestExitData(true, ETH);
            await this.exitGame.setExit(exitId, testExitData);

            const preBalance = new BN(await web3.eth.getBalance(testExitData.exitTarget));
            await this.exitGame.processExit(exitId, VAULT_ID.ETH, ETH, otherAddress);
            const postBalance = new BN(await web3.eth.getBalance(testExitData.exitTarget));
            const expectBalance = preBalance.add(this.startStandardExitBondSize);

            expect(postBalance).to.be.bignumber.equal(expectBalance);
        });

        it('should return exit bounty to the process exit initiator when the exit token is ETH', async () => {
            const exitId = 1;
            const testExitData = getTestExitData(true, ETH);
            await this.exitGame.setExit(exitId, testExitData);

            const bobBalanceBeforeProcessExit = new BN(await web3.eth.getBalance(bob));
            const tx = await this.exitGame.processExit(exitId, VAULT_ID.ETH, ETH, bob, { from: bob });
            const bobBalanceAfterProcessExit = new BN(await web3.eth.getBalance(bob));

            const expectedBobBalance = bobBalanceBeforeProcessExit
                .add(this.processExitBountySize)
                .sub(await spentOnGas(tx.receipt));

            expect(bobBalanceAfterProcessExit).to.be.bignumber.equal(expectedBobBalance);
        });

        it('should return standard exit bond to exit target when the exit token is ERC20', async () => {
            const exitId = 1;
            const erc20Token = (await ERC20Mintable.new()).address;
            const testExitData = getTestExitData(true, erc20Token);
            await this.exitGame.setExit(exitId, testExitData);

            const preBalance = new BN(await web3.eth.getBalance(testExitData.exitTarget));
            await this.exitGame.processExit(exitId, VAULT_ID.ERC20, erc20Token, otherAddress);
            const postBalance = new BN(await web3.eth.getBalance(testExitData.exitTarget));
            const expectBalance = preBalance.add(this.startStandardExitBondSize);

            expect(postBalance).to.be.bignumber.equal(expectBalance);
        });

        it('should return exit bounty to the process exit initiator when the exit token is ERC20', async () => {
            const exitId = 1;
            const erc20Token = (await ERC20Mintable.new()).address;
            const testExitData = getTestExitData(true, erc20Token);
            await this.exitGame.setExit(exitId, testExitData);

            const bobBalanceBeforeProcessExit = new BN(await web3.eth.getBalance(bob));
            const tx = await this.exitGame.processExit(exitId, VAULT_ID.ERC20, erc20Token, bob, { from: bob });
            const bobBalanceAfterProcessExit = new BN(await web3.eth.getBalance(bob));
            const expectedBobBalance = bobBalanceBeforeProcessExit
                .add(this.processExitBountySize)
                .sub(await spentOnGas(tx.receipt));

            expect(bobBalanceAfterProcessExit).to.be.bignumber.equal(expectedBobBalance);
        });

        it('should call the ETH vault with exit amount when the exit token is ETH', async () => {
            const exitId = 1;
            const testExitData = getTestExitData(true, ETH);
            await this.exitGame.setExit(exitId, testExitData);

            const { receipt } = await this.exitGame.processExit(exitId, VAULT_ID.ETH, ETH, otherAddress);
            await expectEvent.inTransaction(receipt.transactionHash, SpyEthVault, 'EthWithdrawCalled', {
                target: testExitData.exitTarget,
                amount: new BN(testExitData.amount),
            });
        });

        it('should call the Erc20 vault with exit amount when the exit token is an ERC 20 token', async () => {
            const exitId = 1;
            const erc20Token = (await ERC20Mintable.new()).address;
            const testExitData = getTestExitData(true, erc20Token);
            await this.exitGame.setExit(exitId, testExitData);

            const { receipt } = await this.exitGame.processExit(exitId, VAULT_ID.ERC20, erc20Token, otherAddress);

            await expectEvent.inTransaction(receipt.transactionHash, SpyErc20Vault, 'Erc20WithdrawCalled', {
                target: testExitData.exitTarget,
                token: testExitData.token,
                amount: new BN(testExitData.amount),
            });
        });

        it('should deletes the standard exit data', async () => {
            const exitId = 1;
            const testExitData = getTestExitData(true, ETH);
            await this.exitGame.setExit(exitId, testExitData);

            await this.exitGame.processExit(exitId, VAULT_ID.ETH, ETH, otherAddress);

            const exitData = (await this.exitGame.standardExits([exitId]))[0];
            expect(exitData).to.deep.equal(EMPTY_EXIT_DATA);
        });

        it('should emit ExitFinalized event', async () => {
            const exitId = 1;
            const testExitData = getTestExitData(true, ETH);
            await this.exitGame.setExit(exitId, testExitData);

            const { logs } = await this.exitGame.processExit(exitId, VAULT_ID.ETH, ETH, otherAddress);

            await expectEvent.inLogs(logs, 'ExitFinalized', { exitId: new BN(exitId) });
        });
    });
});
