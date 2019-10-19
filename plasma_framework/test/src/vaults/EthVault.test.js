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
const { PROTOCOL, OUTPUT_TYPE } = require('../../helpers/constants.js');
const Testlang = require('../../helpers/testlang.js');

contract('EthVault', ([_, authority, maintainer, alice]) => {
    const DEPOSIT_VALUE = 1000000;
    const INITIAL_IMMUNE_VAULTS = 1;
    const INITIAL_IMMUNE_EXIT_GAMES = 1;
    const MIN_EXIT_PERIOD = 10;

    beforeEach('setup contracts', async () => {
        this.framework = await PlasmaFramework.new(
            MIN_EXIT_PERIOD,
            INITIAL_IMMUNE_VAULTS,
            INITIAL_IMMUNE_EXIT_GAMES,
            authority,
            maintainer,
        );
        await this.framework.activateChildChain({ from: authority });
        this.ethVault = await EthVault.new(this.framework.address);
        const depositVerifier = await EthDepositVerifier.new();
        await this.ethVault.setDepositVerifier(depositVerifier.address, { from: maintainer });
        await this.framework.registerVault(1, this.ethVault.address, { from: maintainer });
        this.currentDepositVerifier = depositVerifier.address;

        this.exitGame = await DummyExitGame.new();
        await this.exitGame.setEthVault(this.ethVault.address);
        await this.framework.registerExitGame(1, this.exitGame.address, PROTOCOL.MORE_VP, { from: maintainer });
    });

    describe('deposit', () => {
        it('should store ethereum deposit', async () => {
            const preDepositBlockNumber = (await this.framework.nextDepositBlock()).toNumber();

            const deposit = Testlang.deposit(OUTPUT_TYPE.PAYMENT, DEPOSIT_VALUE, alice);
            await this.ethVault.deposit(deposit, { from: alice, value: DEPOSIT_VALUE });
            const postDepositBlockNumber = (await this.framework.nextDepositBlock()).toNumber();

            expect(postDepositBlockNumber).to.be.equal(preDepositBlockNumber + 1);
        });

        it('should emit deposit event', async () => {
            const preDepositBlockNumber = await this.framework.nextDepositBlock();

            const deposit = Testlang.deposit(OUTPUT_TYPE.PAYMENT, DEPOSIT_VALUE, alice);
            const { receipt } = await this.ethVault.deposit(deposit, { from: alice, value: DEPOSIT_VALUE });
            await expectEvent.inTransaction(
                receipt.transactionHash,
                EthVault,
                'DepositCreated',
                {
                    depositor: alice,
                    blknum: preDepositBlockNumber,
                    token: constants.ZERO_ADDRESS,
                    amount: new BN(DEPOSIT_VALUE),
                },
            );
        });

        it('should charge eth from depositing user', async () => {
            const preDepositBalance = await web3.eth.getBalance(alice);
            const deposit = Testlang.deposit(OUTPUT_TYPE.PAYMENT, DEPOSIT_VALUE, alice);
            const tx = await this.ethVault.deposit(deposit, { from: alice, value: DEPOSIT_VALUE });

            const actualPostDepositBalance = new BN(await web3.eth.getBalance(alice));
            const expectedPostDepositBalance = (new BN(preDepositBalance))
                .sub(new BN(DEPOSIT_VALUE)).sub(await spentOnGas(tx.receipt));

            expect(actualPostDepositBalance).to.be.bignumber.equal(expectedPostDepositBalance);
        });

        it('should not store deposit when output value mismatches sent wei', async () => {
            const deposit = Testlang.deposit(OUTPUT_TYPE.PAYMENT, DEPOSIT_VALUE, alice);

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
            const deposit = Testlang.deposit(OUTPUT_TYPE.PAYMENT, DEPOSIT_VALUE, alice);

            await expectRevert(
                this.ethVault.deposit(deposit, { value: DEPOSIT_VALUE }),
                "Depositor's address does not match sender's address.",
            );
        });

        it('should not store a non-ethereum deposit', async () => {
            const nonEth = Buffer.alloc(20, 1);
            const deposit = Testlang.deposit(OUTPUT_TYPE.PAYMENT, DEPOSIT_VALUE, alice, nonEth);

            await expectRevert(
                this.ethVault.deposit(deposit, { from: alice, value: DEPOSIT_VALUE }),
                'Output does not have correct currency (ETH).',
            );
        });

        it('should not accept transaction that does not match expected transaction type', async () => {
            const output = new PaymentTransactionOutput(
                OUTPUT_TYPE.PAYMENT, DEPOSIT_VALUE, alice, constants.ZERO_ADDRESS,
            );
            const deposit = new PaymentTransaction(123, [0], [output]);

            await expectRevert(
                this.ethVault.deposit(deposit.rlpEncoded(), { from: alice, value: DEPOSIT_VALUE }),
                'Invalid transaction type.',
            );
        });

        it('should not accept transaction with inputs', async () => {
            const output = new PaymentTransactionOutput(
                OUTPUT_TYPE.PAYMENT, DEPOSIT_VALUE, alice, constants.ZERO_ADDRESS,
            );
            const deposit = new PaymentTransaction(1, [0], [output]);

            await expectRevert(
                this.ethVault.deposit(deposit.rlpEncoded(), { from: alice, value: DEPOSIT_VALUE }),
                'Deposit must have no inputs.',
            );
        });

        it('should not accept transaction with more than one output', async () => {
            const output = new PaymentTransactionOutput(
                OUTPUT_TYPE.PAYMENT, DEPOSIT_VALUE, alice, constants.ZERO_ADDRESS,
            );
            const deposit = new PaymentTransaction(1, [], [output, output]);

            await expectRevert(
                this.ethVault.deposit(deposit.rlpEncoded(), { from: alice, value: DEPOSIT_VALUE }),
                'Deposit must have exactly one output.',
            );
        });

        // NOTE: This test would be the same for `Erc20Vault` as all functionality is in base `Vault` contract
        it('deposit verifier waits a period of time before takes effect', async () => {
            const newDepositVerifier = await EthDepositVerifier.new();

            expect(await this.ethVault.getEffectiveDepositVerifier()).to.equal(this.currentDepositVerifier);

            const tx = await this.ethVault.setDepositVerifier(newDepositVerifier.address, { from: maintainer });
            expect(await this.ethVault.getEffectiveDepositVerifier()).to.equal(this.currentDepositVerifier);
            await expectEvent.inLogs(tx.logs, 'SetDepositVerifierCalled', { nextDepositVerifier: newDepositVerifier.address });

            await time.increase(MIN_EXIT_PERIOD);
            expect(await this.ethVault.getEffectiveDepositVerifier()).to.equal(newDepositVerifier.address);
        });
    });

    describe('withdraw', () => {
        beforeEach(async () => {
            const deposit = Testlang.deposit(OUTPUT_TYPE.PAYMENT, DEPOSIT_VALUE, alice);
            await this.ethVault.deposit(deposit, { from: alice, value: DEPOSIT_VALUE });
        });

        it('should fail when not called by a registered exit game contract', async () => {
            await expectRevert(
                this.ethVault.withdraw(constants.ZERO_ADDRESS, 0),
                'Called from a nonregistered or quarantined Exit Game contract',
            );
        });

        it('should transfer ETH to the receiver', async () => {
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
                    receiver: alice,
                    amount: new BN(DEPOSIT_VALUE),
                },
            );
        });

        describe('given quarantined exit game', () => {
            beforeEach(async () => {
                this.newExitGame = await DummyExitGame.new();
                await this.newExitGame.setEthVault(this.ethVault.address);
                await this.framework.registerExitGame(
                    2, this.newExitGame.address, PROTOCOL.MORE_VP, { from: maintainer },
                );
            });

            it('should fail when called under quarantine', async () => {
                await expectRevert(
                    this.newExitGame.proxyEthWithdraw(alice, DEPOSIT_VALUE),
                    'Called from a nonregistered or quarantined Exit Game contract',
                );
            });

            it('should succeed after quarantine period passes', async () => {
                await time.increase(3 * MIN_EXIT_PERIOD + 1);
                const { receipt } = await this.newExitGame.proxyEthWithdraw(alice, DEPOSIT_VALUE);

                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    EthVault,
                    'EthWithdrawn',
                    {
                        receiver: alice,
                        amount: new BN(DEPOSIT_VALUE),
                    },
                );
            });
        });
    });
});
