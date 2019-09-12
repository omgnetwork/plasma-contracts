const PlasmaFramework = artifacts.require('PlasmaFramework');
const Erc20Vault = artifacts.require('Erc20Vault');
const Erc20DepositVerifier = artifacts.require('Erc20DepositVerifier');
const ERC20Mintable = artifacts.require('ERC20Mintable');
const NonCompliantERC20 = artifacts.require('NonCompliantERC20');
const DummyExitGame = artifacts.require('DummyExitGame');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const Testlang = require('../../helpers/testlang.js');
const { PaymentTransaction, PaymentTransactionOutput } = require('../../helpers/transaction.js');
const { PROTOCOL } = require('../../helpers/constants.js');

contract('Erc20Vault', (accounts) => {
    const alice = accounts[1];
    const DEPOSIT_VALUE = 100;
    const INITIAL_SUPPLY = 1000000;
    const INITIAL_IMMUNE_VAULTS = 1;
    const INITIAL_IMMUNE_EXIT_GAMES = 1;
    const MIN_EXIT_PERIOD = 10;


    beforeEach('setup contracts', async () => {
        this.framework = await PlasmaFramework.new(MIN_EXIT_PERIOD, INITIAL_IMMUNE_VAULTS, INITIAL_IMMUNE_EXIT_GAMES);
        this.erc20Vault = await Erc20Vault.new(this.framework.address);
        const depositVerifier = await Erc20DepositVerifier.new();
        await this.erc20Vault.setDepositVerifier(depositVerifier.address);
        await this.framework.registerVault(2, this.erc20Vault.address);

        this.exitGame = await DummyExitGame.new();
        await this.exitGame.setErc20Vault(this.erc20Vault.address);
        await this.framework.registerExitGame(1, this.exitGame.address, PROTOCOL.MORE_VP);

        this.erc20 = await ERC20Mintable.new();
        await this.erc20.mint(accounts[0], INITIAL_SUPPLY, { from: accounts[0] });
        await this.erc20.transfer(alice, DEPOSIT_VALUE, { from: accounts[0] });
    });

    describe('deposit', () => {
        it('should store erc20 deposit', async () => {
            await this.erc20.approve(this.erc20Vault.address, DEPOSIT_VALUE, { from: alice });
            const preDepositBlockNumber = (await this.framework.nextDepositBlock()).toNumber();

            const deposit = Testlang.deposit(DEPOSIT_VALUE, alice, this.erc20.address);
            await this.erc20Vault.deposit(deposit, { from: alice });
            const postDepositBlockNumber = (await this.framework.nextDepositBlock()).toNumber();

            expect(postDepositBlockNumber).to.be.equal(preDepositBlockNumber + 1);
        });

        it('should emit deposit event', async () => {
            await this.erc20.approve(this.erc20Vault.address, DEPOSIT_VALUE, { from: alice });
            const preDepositBlockNumber = await this.framework.nextDepositBlock();

            const deposit = Testlang.deposit(DEPOSIT_VALUE, alice, this.erc20.address);
            const { receipt } = await this.erc20Vault.deposit(deposit, { from: alice });
            await expectEvent.inTransaction(
                receipt.transactionHash,
                Erc20Vault,
                'DepositCreated',
                {
                    depositor: alice,
                    blknum: preDepositBlockNumber,
                    token: this.erc20.address,
                    amount: new BN(DEPOSIT_VALUE),
                },
            );
        });

        it('should spend erc20 tokens from depositing user', async () => {
            const preDepositBalance = await this.erc20.balanceOf(alice);

            await this.erc20.approve(this.erc20Vault.address, DEPOSIT_VALUE, { from: alice });
            const deposit = Testlang.deposit(DEPOSIT_VALUE, alice, this.erc20.address);
            await this.erc20Vault.deposit(deposit, { from: alice });

            const actualPostDepositBalance = new BN(await this.erc20.balanceOf(alice));
            const expectedPostDepositBalance = (new BN(preDepositBalance)).sub(new BN(DEPOSIT_VALUE));

            expect(actualPostDepositBalance).to.be.bignumber.equal(expectedPostDepositBalance);
        });

        it('should not store a deposit when the tokens have not been approved', async () => {
            const deposit = Testlang.deposit(DEPOSIT_VALUE, alice, this.erc20.address);

            await expectRevert(
                this.erc20Vault.deposit(deposit, { from: alice }),
                'Tokens have not been approved',
            );
        });

        it('should not store a deposit from user who does not match output address', async () => {
            const deposit = Testlang.deposit(DEPOSIT_VALUE, alice, this.erc20.address);

            await expectRevert(
                this.erc20Vault.deposit(deposit),
                "Depositor's address does not match sender's address.",
            );
        });

        it('should not store an ethereum deposit that sends funds', async () => {
            const deposit = Testlang.deposit(DEPOSIT_VALUE, alice);

            await expectRevert.unspecified(
                this.erc20Vault.deposit(deposit, { from: alice, value: DEPOSIT_VALUE }),
            );
        });

        it('should not store an ethereum deposit that does not send funds', async () => {
            const deposit = Testlang.deposit(DEPOSIT_VALUE, alice);

            await expectRevert(
                this.erc20Vault.deposit(deposit, { from: alice }),
                'Invalid output currency (ETH)',
            );
        });

        it('should not accept transaction that does not match expected transaction type', async () => {
            const output = new PaymentTransactionOutput(DEPOSIT_VALUE, alice, this.erc20.address);
            const WRONG_TX_TYPE = 123;
            const deposit = new PaymentTransaction(WRONG_TX_TYPE, [0], [output]);

            await expectRevert(
                this.erc20Vault.deposit(deposit.rlpEncoded(), { from: alice }),
                'Invalid transaction type.',
            );
        });

        it('should not accept transaction with inputs', async () => {
            const output = new PaymentTransactionOutput(DEPOSIT_VALUE, alice, this.erc20.address);
            const deposit = new PaymentTransaction(1, [0], [output]);

            await expectRevert(
                this.erc20Vault.deposit(deposit.rlpEncoded(), { from: alice }),
                'Deposit must have no inputs',
            );
        });

        it('should not accept transaction with more than one output', async () => {
            const output = new PaymentTransactionOutput(DEPOSIT_VALUE, alice, this.erc20.address);
            const deposit = new PaymentTransaction(1, [], [output, output]);

            await expectRevert(
                this.erc20Vault.deposit(deposit.rlpEncoded(), { from: alice }),
                'Deposit must have exactly one output',
            );
        });
    });

    describe('deposit from NonCompliantERC20', () => {
        // A 'NonCompliantERC20' token is one that uses an old version of the ERC20 standard,
        // as described here https://medium.com/coinmonks/missing-return-value-bug-at-least-130-tokens-affected-d67bf08521ca
        // Erc20Vault should support both versions.
        before('setup', async () => {
            this.nonCompliantERC20 = await NonCompliantERC20.new(INITIAL_SUPPLY);
            await this.nonCompliantERC20.transfer(alice, DEPOSIT_VALUE, { from: accounts[0] });
        });

        it('should store erc20 deposit', async () => {
            await this.nonCompliantERC20.approve(this.erc20Vault.address, DEPOSIT_VALUE, { from: alice });
            const preDepositBlockNumber = (await this.framework.nextDepositBlock()).toNumber();

            const deposit = Testlang.deposit(DEPOSIT_VALUE, alice, this.nonCompliantERC20.address);
            await this.erc20Vault.deposit(deposit, { from: alice });
            const postDepositBlockNumber = (await this.framework.nextDepositBlock()).toNumber();

            expect(postDepositBlockNumber).to.be.equal(preDepositBlockNumber + 1);
        });
    });

    describe('withdraw', () => {
        beforeEach(async () => {
            this.testFundAmount = 1000;
            await this.erc20.transfer(this.erc20Vault.address, this.testFundAmount, { from: accounts[0] });
        });

        it('should fail when not called by a registered exit game contract', async () => {
            await expectRevert(
                this.erc20Vault.withdraw(constants.ZERO_ADDRESS, constants.ZERO_ADDRESS, 0),
                'Called from a nonregistered or quarantined Exit Game contract',
            );
        });

        it('should transfer ERC token to the target', async () => {
            const preBalance = await this.erc20.balanceOf(alice);

            await this.exitGame.proxyErc20Withdraw(alice, this.erc20.address, this.testFundAmount);

            const postBalance = await this.erc20.balanceOf(alice);
            const expectedPostBalance = preBalance.add(new BN(this.testFundAmount));

            expect(postBalance).to.be.bignumber.equal(expectedPostBalance);
        });

        it('should emit Erc20Withdrawn event correctly', async () => {
            const { receipt } = await this.exitGame.proxyErc20Withdraw(
                alice, this.erc20.address, this.testFundAmount,
            );

            await expectEvent.inTransaction(
                receipt.transactionHash,
                Erc20Vault,
                'Erc20Withdrawn',
                {
                    target: alice,
                    token: this.erc20.address,
                    amount: new BN(this.testFundAmount),
                },
            );
        });

        describe('given quarantined exit game', () => {
            beforeEach(async () => {
                this.newExitGame = await DummyExitGame.new();
                await this.newExitGame.setErc20Vault(this.erc20Vault.address);
                await this.framework.registerExitGame(2, this.newExitGame.address, PROTOCOL.MORE_VP);
            });

            it('should fail when called under quarantine', async () => {
                await expectRevert(
                    this.newExitGame.proxyErc20Withdraw(alice, this.erc20.address, this.testFundAmount),
                    'Called from a nonregistered or quarantined Exit Game contract',
                );
            });

            it('should succeed after quarantine period passes', async () => {
                await time.increase(3 * MIN_EXIT_PERIOD + 1);
                const { receipt } = await this.newExitGame.proxyErc20Withdraw(
                    alice, this.erc20.address, this.testFundAmount,
                );

                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    Erc20Vault,
                    'Erc20Withdrawn',
                    {
                        target: alice,
                        token: this.erc20.address,
                        amount: new BN(this.testFundAmount),
                    },
                );
            });
        });
    });

    describe('withdraw with NonCompliantERC20', () => {
        beforeEach(async () => {
            this.testFundAmount = 1000;
            this.nonCompliantERC20 = await NonCompliantERC20.new(INITIAL_SUPPLY);
            await this.nonCompliantERC20.transfer(this.erc20Vault.address, this.testFundAmount, { from: accounts[0] });
        });

        it('should transfer ERC token to the target', async () => {
            const preBalance = await this.nonCompliantERC20.balanceOf(alice);

            await this.exitGame.proxyErc20Withdraw(alice, this.nonCompliantERC20.address, this.testFundAmount);

            const postBalance = await this.nonCompliantERC20.balanceOf(alice);
            const expectedPostBalance = preBalance.add(new BN(this.testFundAmount));

            expect(postBalance).to.be.bignumber.equal(expectedPostBalance);
        });
    });
});
