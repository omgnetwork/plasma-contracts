const BlockController = artifacts.require('BlockController');
const EthVault = artifacts.require('EthVault');

const { BN, constants, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const Testlang = require('../../helpers/testlang.js');
const { PaymentTransaction, PaymentTransactionOutput } = require('../../helpers/transaction.js');

contract('EthVault', (accounts) => {
    const alice = accounts[1];
    const DEPOSIT_VALUE = 1000000;

    beforeEach('setup contracts', async () => {
        this.blockController = await BlockController.new(10);
        this.ethVault = await EthVault.new(this.blockController.address);
        await this.blockController.registerVault(1, this.ethVault.address);
    });

    describe('deposit', () => {
        it('should store ethereum deposit', async () => {
            const preDepositBlockNumber = (await this.blockController.nextDepositBlock()).toNumber();

            const deposit = Testlang.deposit(DEPOSIT_VALUE, alice);
            await this.ethVault.deposit(deposit, { from: alice, value: DEPOSIT_VALUE });
            const postDepositBlockNumber = (await this.blockController.nextDepositBlock()).toNumber();

            expect(postDepositBlockNumber).to.be.equal(preDepositBlockNumber + 1);
        });

        it('should charge eth from depositing user', async () => {
            const preDepositBalance = await web3.eth.getBalance(alice);
            const deposit = Testlang.deposit(DEPOSIT_VALUE, alice);
            const tx = await this.ethVault.deposit(deposit, { from: alice, value: DEPOSIT_VALUE });

            const actualPostDepositBalance = new BN(await web3.eth.getBalance(alice));
            const expectedPostDepositBalance = (new BN(preDepositBalance))
                .sub(new BN(DEPOSIT_VALUE)).sub(await spentOnGas(tx.receipt));

            expect(actualPostDepositBalance).to.be.bignumber.equal(expectedPostDepositBalance);
        });

        it('should not store deposit when output value mismatches sent wei', async () => {
            const deposit = Testlang.deposit(DEPOSIT_VALUE, alice);

            await expectRevert(
                this.ethVault.deposit(deposit, { from: alice, value: DEPOSIT_VALUE + 1 }),
                'Deposited value does not match sent amount.',
            );

            await expectRevert(
                this.ethVault.deposit(deposit, { from: alice, value: DEPOSIT_VALUE - 1 }),
                'Deposited value does not match sent amount.',
            );
        });

        it('should not store a deposit from user who does not match output address', async () => {
            const deposit = Testlang.deposit(DEPOSIT_VALUE, alice);

            await expectRevert(
                this.ethVault.deposit(deposit, { value: DEPOSIT_VALUE }),
                "Depositor's address does not match sender's address.",
            );
        });

        it('should not store a non-ethereum deposit', async () => {
            const nonEth = Buffer.alloc(20, 1);
            const deposit = Testlang.deposit(DEPOSIT_VALUE, alice, nonEth);

            await expectRevert(
                this.ethVault.deposit(deposit, { from: alice, value: DEPOSIT_VALUE }),
                'Output does not have correct currency (ETH).',
            );
        });

        it('should not accept transaction that does not match expected transaction type', async () => {
            const output = new PaymentTransactionOutput(DEPOSIT_VALUE, alice, constants.ZERO_ADDRESS);
            const deposit = new PaymentTransaction(123, [0], [output]);

            await expectRevert(
                this.ethVault.deposit(deposit.rlpEncoded(), { from: alice, value: DEPOSIT_VALUE }),
                'Invalid transaction type.',
            );
        });

        it('should not accept transaction that does not conform to deposit input format', async () => {
            const invalidInput = Buffer.alloc(32, 1);
            const output = new PaymentTransactionOutput(DEPOSIT_VALUE, alice, constants.ZERO_ADDRESS);
            const deposit = new PaymentTransaction(1, [invalidInput], [output]);

            await expectRevert(
                this.ethVault.deposit(deposit.rlpEncoded(), { from: alice, value: DEPOSIT_VALUE }),
                'Deposit input must be bytes32 of 0.',
            );
        });

        it('should not accept transaction with more than one output', async () => {
            const output = new PaymentTransactionOutput(DEPOSIT_VALUE, alice, constants.ZERO_ADDRESS);
            const deposit = new PaymentTransaction(1, [0], [output, output]);

            await expectRevert(
                this.ethVault.deposit(deposit.rlpEncoded(), { from: alice, value: DEPOSIT_VALUE }),
                'Must have only one output.',
            );
        });
    });
});

async function spentOnGas(receipt) {
    const tx = await web3.eth.getTransaction(receipt.transactionHash);
    return web3.utils.toBN(tx.gasPrice).muln(receipt.gasUsed);
}
