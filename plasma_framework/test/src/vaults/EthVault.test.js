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
const {
    PROTOCOL, OUTPUT_TYPE, TX_TYPE, SAFE_GAS_STIPEND, DUMMY_INPUT_1,
} = require('../../helpers/constants.js');
const Testlang = require('../../helpers/testlang.js');

contract('EthVault', ([_, authority, maintainer, alice]) => {
    const DEPOSIT_VALUE = 1000000;
    const INITIAL_IMMUNE_VAULTS = 1;
    const INITIAL_IMMUNE_EXIT_GAMES = 1;
    const MIN_EXIT_PERIOD = 10;

    const setupContractsWithoutDepositVerifier = async () => {
        this.framework = await PlasmaFramework.new(
            MIN_EXIT_PERIOD,
            INITIAL_IMMUNE_VAULTS,
            INITIAL_IMMUNE_EXIT_GAMES,
            authority,
            maintainer,
        );
        this.ethVault = await EthVault.new(this.framework.address, SAFE_GAS_STIPEND);

        await this.framework.registerVault(1, this.ethVault.address, { from: maintainer });

        this.exitGame = await DummyExitGame.new();
        await this.exitGame.setEthVault(this.ethVault.address);
        await this.framework.registerExitGame(1, this.exitGame.address, PROTOCOL.MORE_VP, { from: maintainer });
    };

    const setupAllContracts = async () => {
        await setupContractsWithoutDepositVerifier();
        const depositVerifier = await EthDepositVerifier.new(TX_TYPE.PAYMENT, OUTPUT_TYPE.PAYMENT);
        await this.ethVault.setDepositVerifier(depositVerifier.address, { from: maintainer });
    };

    describe('deposit', () => {
        describe('before deposit verifier has been set', () => {
            beforeEach(setupContractsWithoutDepositVerifier);

            it('should fail with error message', async () => {
                const deposit = Testlang.deposit(OUTPUT_TYPE.PAYMENT, DEPOSIT_VALUE, alice);

                await expectRevert(
                    this.ethVault.deposit(deposit, { from: alice, value: DEPOSIT_VALUE + 1 }),
                    'Deposit verifier has not been set',
                );
            });
        });

        describe('after all related contracts set', () => {
            beforeEach(setupAllContracts);

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
                    'Deposited value must match sent amount.',
                );

                await expectRevert(
                    this.ethVault.deposit(deposit, { from: alice, value: DEPOSIT_VALUE - 1 }),
                    'Deposited value must match sent amount.',
                );
            });

            it('should not store a deposit from user who does not match output address', async () => {
                const deposit = Testlang.deposit(OUTPUT_TYPE.PAYMENT, DEPOSIT_VALUE, alice);

                await expectRevert(
                    this.ethVault.deposit(deposit, { value: DEPOSIT_VALUE }),
                    "Depositor's address must match sender's address",
                );
            });

            it('should not store a non-ethereum deposit', async () => {
                const nonEth = Buffer.alloc(20, 1);
                const deposit = Testlang.deposit(OUTPUT_TYPE.PAYMENT, DEPOSIT_VALUE, alice, nonEth);

                await expectRevert(
                    this.ethVault.deposit(deposit, { from: alice, value: DEPOSIT_VALUE }),
                    'Output requires correct currency (ETH).',
                );
            });

            it('should not accept a deposit with invalid output type', async () => {
                const unsupportedOutputType = 2;
                const deposit = Testlang.deposit(unsupportedOutputType, DEPOSIT_VALUE, alice);

                await expectRevert(
                    this.ethVault.deposit(deposit, { from: alice, value: DEPOSIT_VALUE }),
                    'Invalid output type',
                );
            });

            it('should not accept transaction that does not match expected transaction type', async () => {
                const output = new PaymentTransactionOutput(
                    OUTPUT_TYPE.PAYMENT, DEPOSIT_VALUE, alice, constants.ZERO_ADDRESS,
                );
                const deposit = new PaymentTransaction(123, [DUMMY_INPUT_1], [output]);

                await expectRevert(
                    this.ethVault.deposit(deposit.rlpEncoded(), { from: alice, value: DEPOSIT_VALUE }),
                    'Invalid transaction type.',
                );
            });

            it('should not accept transaction with inputs', async () => {
                const output = new PaymentTransactionOutput(
                    OUTPUT_TYPE.PAYMENT, DEPOSIT_VALUE, alice, constants.ZERO_ADDRESS,
                );
                const deposit = new PaymentTransaction(1, [DUMMY_INPUT_1], [output]);

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
        });
    });

    describe('withdraw', () => {
        beforeEach(async () => {
            await setupAllContracts();

            const deposit = Testlang.deposit(OUTPUT_TYPE.PAYMENT, DEPOSIT_VALUE, alice);
            await this.ethVault.deposit(deposit, { from: alice, value: DEPOSIT_VALUE });
        });

        it('should fail when not called by a registered exit game contract', async () => {
            await expectRevert(
                this.ethVault.withdraw(constants.ZERO_ADDRESS, 0),
                'Called from a non-registered or quarantined exit game contract',
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

        describe('when fund transfer fails', () => {
            beforeEach(async () => {
                // fails by asking more fund then what the vault has
                this.amount = 2 * DEPOSIT_VALUE;
                this.preBalance = new BN(await web3.eth.getBalance(this.ethVault.address));
                const { receipt } = await this.exitGame.proxyEthWithdraw(alice, this.amount);
                this.withdrawReceipt = receipt;
            });

            it('should emit WithdrawFailed event', async () => {
                await expectEvent.inTransaction(
                    this.withdrawReceipt.transactionHash,
                    EthVault,
                    'WithdrawFailed',
                    {
                        receiver: alice,
                        amount: new BN(this.amount),
                    },
                );
            });

            it('should not transfer ETH', async () => {
                const postBalance = new BN(await web3.eth.getBalance(this.ethVault.address));
                expect(postBalance).to.be.bignumber.equal(this.preBalance);
            });
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
                    'Called from a non-registered or quarantined exit game contract',
                );
            });

            it('should succeed after quarantine period passes', async () => {
                await time.increase(4 * MIN_EXIT_PERIOD + 1);
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
