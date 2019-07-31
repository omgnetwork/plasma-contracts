const PlasmaFramework = artifacts.require('PlasmaFramework');
const EthVault = artifacts.require('EthVault');
const EthDepositVerifier = artifacts.require('EthDepositVerifier');
const DummyExitGame = artifacts.require('DummyExitGame');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { PaymentTransaction, PaymentTransactionOutput } = require('../../helpers/transaction.js');
const { spentOnGas } = require('../../helpers/utils.js');
const Testlang = require('../../helpers/testlang.js');

contract('EthVault', ([_, alice]) => {
    const DEPOSIT_VALUE = 1000000;
    const INITIAL_IMMUNE_VAULTS = 1;
    const INITIAL_IMMUNE_EXIT_GAMES = 0;
    const MIN_EXIT_PERIOD = 10;

    beforeEach('setup contracts', async () => {
        this.framework = await PlasmaFramework.new(MIN_EXIT_PERIOD, INITIAL_IMMUNE_VAULTS, INITIAL_IMMUNE_EXIT_GAMES);
        this.ethVault = await EthVault.new(this.framework.address);
        const depositVerifier = await EthDepositVerifier.new();
        await this.ethVault.setDepositVerifier(depositVerifier.address);
        await this.framework.registerVault(1, this.ethVault.address);
        this.currentDepositVerifier = depositVerifier.address;

        this.exitGame = await DummyExitGame.new();
        await this.exitGame.setEthVault(this.ethVault.address);
        await this.framework.registerExitGame(1, this.exitGame.address);
    });

    describe('deposit', () => {
        it('should store ethereum deposit', async () => {
            const preDepositBlockNumber = (await this.framework.nextDepositBlock()).toNumber();

            const deposit = Testlang.deposit(DEPOSIT_VALUE, alice);
            await this.ethVault.deposit(deposit, { from: alice, value: DEPOSIT_VALUE });
            const postDepositBlockNumber = (await this.framework.nextDepositBlock()).toNumber();

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

        it('deposit verifier waits a period of time before takes effect', async () => {
            const depositValue = DEPOSIT_VALUE / 2;
            const deposit = Testlang.deposit(depositValue, alice);
            expect(this.currentDepositVerifier).to.not.equal(null);

            const newDepositVerifier = await EthDepositVerifier.new();
            await this.ethVault.setDepositVerifier(newDepositVerifier.address);

            await this.ethVault.deposit(deposit, { from: alice, value: depositValue });
            expect(await this.ethVault.getDepositVerifier()).to.equal(this.currentDepositVerifier);


            await time.increase(MIN_EXIT_PERIOD + 1);
            await this.ethVault.deposit(deposit, { from: alice, value: depositValue });

            expect(await this.ethVault.getDepositVerifier()).to.equal(newDepositVerifier.address);
        });
    });

    describe('withdraw', () => {
        beforeEach(async () => {
            const deposit = Testlang.deposit(DEPOSIT_VALUE, alice);
            await this.ethVault.deposit(deposit, { from: alice, value: DEPOSIT_VALUE });
        });

        it('should fail when not called by a registered exit game contract', async () => {
            await expectRevert(
                this.ethVault.withdraw(constants.ZERO_ADDRESS, 0),
                'Not called from a registered Exit Game contract',
            );
        });

        it('should transfer ETH to the target', async () => {
            const preBalance = new BN(await web3.eth.getBalance(alice));

            await this.exitGame.proxyEthWithdraw(alice, DEPOSIT_VALUE);

            const postBalance = new BN(await web3.eth.getBalance(alice));
            const expectedPostBalance = preBalance.add(new BN(DEPOSIT_VALUE));

            expect(postBalance).to.be.bignumber.equal(expectedPostBalance);
        });

        it('should emit EthWithdrawn event correctly', async () => {
            const { receipt } = await this.exitGame.proxyEthWithdraw(alice, DEPOSIT_VALUE);

            await expectEvent.inTransaction(
                receipt.transactionHash,
                EthVault,
                'EthWithdrawn',
                {
                    target: alice,
                    amount: new BN(DEPOSIT_VALUE),
                },
            );
        });
    });
});
