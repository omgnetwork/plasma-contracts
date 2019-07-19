const BlockController = artifacts.require('BlockController');
const Quarantine = artifacts.require('Quarantine');
const Erc20Vault = artifacts.require('Erc20Vault');
const Erc20DepositVerifier = artifacts.require('Erc20DepositVerifier');
const GoodERC20 = artifacts.require('GoodERC20');
const BadERC20 = artifacts.require('BadERC20');

const { BN, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const Testlang = require('../../helpers/testlang.js');
const { PaymentTransaction, PaymentTransactionOutput } = require('../../helpers/transaction.js');

contract('Erc20Vault', (accounts) => {
    const alice = accounts[1];
    const DEPOSIT_VALUE = 100;
    const INITIAL_SUPPLY = 1000000;
    const MIN_EXIT_PERIOD = 0;
    const INITIAL_IMMUNE_VAULTS = 1;

    beforeEach('setup contracts', async () => {
        const quarantine = await Quarantine.new();
        await BlockController.link('Quarantine', quarantine.address);
        this.blockController = await BlockController.new(10, MIN_EXIT_PERIOD, INITIAL_IMMUNE_VAULTS);
        this.erc20Vault = await Erc20Vault.new(this.blockController.address);
        const depositVerifier = await Erc20DepositVerifier.new();
        await this.erc20Vault.setDepositVerifier(depositVerifier.address);
        await this.blockController.registerVault(2, this.erc20Vault.address);
        this.erc20 = await GoodERC20.new();
        this.erc20.mint(accounts[0], INITIAL_SUPPLY, { from: accounts[0] });
        await this.erc20.transfer(alice, DEPOSIT_VALUE, { from: accounts[0] });
    });

    describe('deposit', () => {
        it('should store erc20 deposit', async () => {
            await this.erc20.approve(this.erc20Vault.address, DEPOSIT_VALUE, { from: alice });
            const preDepositBlockNumber = (await this.blockController.nextDepositBlock()).toNumber();

            const deposit = Testlang.deposit(DEPOSIT_VALUE, alice, this.erc20.address);
            await this.erc20Vault.deposit(deposit, { from: alice });
            const postDepositBlockNumber = (await this.blockController.nextDepositBlock()).toNumber();

            expect(postDepositBlockNumber).to.be.equal(preDepositBlockNumber + 1);
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

        it('should not accept transaction that does not conform to deposit input format', async () => {
            const invalidInput = Buffer.alloc(32, 1);
            const output = new PaymentTransactionOutput(DEPOSIT_VALUE, alice, this.erc20.address);
            const deposit = new PaymentTransaction(1, [invalidInput], [output]);

            await expectRevert(
                this.erc20Vault.deposit(deposit.rlpEncoded(), { from: alice }),
                'Deposit input must be bytes32 of 0',
            );
        });

        it('should not accept transaction with more than one output', async () => {
            const output = new PaymentTransactionOutput(DEPOSIT_VALUE, alice, this.erc20.address);
            const deposit = new PaymentTransaction(1, [0], [output, output]);

            await expectRevert(
                this.erc20Vault.deposit(deposit.rlpEncoded(), { from: alice }),
                'Must have only one output',
            );
        });
    });

    describe('deposit from BadERC20', () => {
        // A 'BadERC20' token is one that uses an old version of the ERC20 standard,
        // as described here https://medium.com/coinmonks/missing-return-value-bug-at-least-130-tokens-affected-d67bf08521ca
        // Erc20Vault should support both versions.
        before('setup', async () => {
            this.badErc20 = await BadERC20.new(INITIAL_SUPPLY);
            await this.badErc20.transfer(alice, DEPOSIT_VALUE, { from: accounts[0] });
        });

        it('should store erc20 deposit', async () => {
            await this.badErc20.approve(this.erc20Vault.address, DEPOSIT_VALUE, { from: alice });
            const preDepositBlockNumber = (await this.blockController.nextDepositBlock()).toNumber();

            const deposit = Testlang.deposit(DEPOSIT_VALUE, alice, this.badErc20.address);
            await this.erc20Vault.deposit(deposit, { from: alice });
            const postDepositBlockNumber = (await this.blockController.nextDepositBlock()).toNumber();

            expect(postDepositBlockNumber).to.be.equal(preDepositBlockNumber + 1);
        });
    });
});
