const RLP = artifacts.require('RLP');
const OutputModel = artifacts.require('OutputModel');
const TransactionModel = artifacts.require('TransactionModel');
const PlasmaFramework = artifacts.require('PlasmaFramework');
const Erc20Vault = artifacts.require('Erc20Vault');
const ERC20 = artifacts.require('ERC20Mintable');
const BadERC20 = artifacts.require('BadERC20');

const { BN, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const Testlang = require('../helpers/testlang.js');
const { Transaction } = require('../helpers/transaction.js');
const { TransactionOutput } = require('../helpers/transaction.js');

contract('Erc20Vault', (accounts) => {
  const alice = accounts[1];

  const DepositValue = 100;
  const initialSupply = 1000000;

  before('setup libs', async () => {
    const rlpLib = await RLP.new();
    OutputModel.link('RLP', rlpLib.address);
    const outputModel = await OutputModel.new();

    TransactionModel.link('RLP', rlpLib.address);
    TransactionModel.link('TransactionOutput', outputModel.address);
    const transactionModel = await TransactionModel.new();
    Erc20Vault.link('TransactionModel', transactionModel.address);
  });

  beforeEach('setup contracts', async () => {
    this.plasma = await PlasmaFramework.new();
    this.erc20Vault = await Erc20Vault.new(this.plasma.address);
    await this.plasma.registerVault(2, this.erc20Vault.address);
    this.erc20 = await ERC20.new();
    this.erc20.mint(accounts[0], initialSupply, { from: accounts[0] });
    await this.erc20.transfer(alice, DepositValue, { from: accounts[0] });
  });

  describe('deposit', () => {
    it('should store erc20 deposit', async () => {
      await this.erc20.approve(this.erc20Vault.address, DepositValue, { from: alice });
      let nextDepositBlock = parseInt(await this.plasma.nextDepositBlock(), 10);
      expect(nextDepositBlock).to.be.equal(1);

      const deposit = Testlang.deposit(DepositValue, alice, this.erc20.address);
      await this.erc20Vault.deposit(deposit, { from: alice });
      nextDepositBlock = parseInt(await this.plasma.nextDepositBlock(), 10);
      expect(nextDepositBlock).to.be.equal(2);
    });

    it('should spend erc20 tokens from depositing user', async () => {
      const preDepositBalance = await this.erc20.balanceOf(alice);

      await this.erc20.approve(this.erc20Vault.address, DepositValue, { from: alice });
      const deposit = Testlang.deposit(DepositValue, alice, this.erc20.address);
      await this.erc20Vault.deposit(deposit, { from: alice });

      const actualPostDepositBalance = new BN(await this.erc20.balanceOf(alice));
      const expectedPostDepositBalance = (new BN(preDepositBalance)).sub(new BN(DepositValue));

      expect(actualPostDepositBalance).to.be.bignumber.equal(expectedPostDepositBalance);
    });

    it('should not store a deposit when the tokens have not been approved', async () => {
      const deposit = Testlang.deposit(DepositValue, alice, this.erc20.address);

      await expectRevert(
        this.erc20Vault.deposit(deposit, { from: alice }),
        'Tokens have not been approved',
      );
    });

    it('should not store a deposit from user who does not match output address', async () => {
      const deposit = Testlang.deposit(DepositValue, alice, this.erc20.address);

      await expectRevert(
        this.erc20Vault.deposit(deposit),
        'Depositors address does not match senders address.',
      );
    });

    it('should not store an ethereum deposit that sends funds', async () => {
      const deposit = Testlang.deposit(DepositValue, alice);

      await expectRevert.unspecified(this.erc20Vault.deposit(deposit, { from: alice, value: DepositValue }));
    });

    it('should not store an ethereum deposit that does not send funds', async () => {
      const deposit = Testlang.deposit(DepositValue, alice);

      await expectRevert(
        this.erc20Vault.deposit(deposit, { from: alice }),
        'Invalid output currency (0x0)',
      );
    });

    it('should not accept transaction that does not match expected transaction type', async () => {
      const output = new TransactionOutput(DepositValue, alice, this.erc20.address);
      const deposit = new Transaction(123, [0], [output]);

      await expectRevert(
        this.erc20Vault.deposit(deposit.rlpEncoded(), { from: alice }),
        'Invalid transaction type.',
      );
    });

    it('should not accept transaction that does not conform to deposit input format', async () => {
      const invalidInput = Buffer.alloc(32, 1);
      const output = new TransactionOutput(DepositValue, alice, this.erc20.address);
      const deposit = new Transaction(1, [invalidInput], [output]);

      await expectRevert(
        this.erc20Vault.deposit(deposit.rlpEncoded(), { from: alice }),
        'Invalid input format',
      );
    });

    it('should not accept transaction with more than one output', async () => {
      const output = new TransactionOutput(DepositValue, alice, this.erc20.address);
      const deposit = new Transaction(1, [0], [output, output]);

      await expectRevert(
        this.erc20Vault.deposit(deposit.rlpEncoded(), { from: alice }),
        'Invalid number of outputs.',
      );
    });
  });

  describe('deposit from BadERC20', () => {
    before('setup', async () => {
      this.badErc20 = await BadERC20.new(initialSupply);
      await this.badErc20.transfer(alice, DepositValue, { from: accounts[0] });
    });

    it('should store erc20 deposit', async () => {
      await this.badErc20.approve(this.erc20Vault.address, DepositValue, { from: alice });
      let nextDepositBlock = parseInt(await this.plasma.nextDepositBlock(), 10);
      expect(nextDepositBlock).to.be.equal(1);

      const deposit = Testlang.deposit(DepositValue, alice, this.badErc20.address);
      await this.erc20Vault.deposit(deposit, { from: alice });
      nextDepositBlock = parseInt(await this.plasma.nextDepositBlock(), 10);
      expect(nextDepositBlock).to.be.equal(2);
    });
  });
});
