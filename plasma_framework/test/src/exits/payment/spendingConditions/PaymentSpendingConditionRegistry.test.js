const PaymentSpendingConditionRegistry = artifacts.require('PaymentSpendingConditionRegistry');
const DummyPaymentSpendingCondition = artifacts.require('PaymentSpendingConditionTrue');

const { constants, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('PaymentSpendingConditionRegistry', ([_, other]) => {
    beforeEach(async () => {
        this.registry = await PaymentSpendingConditionRegistry.new();
        this.dummyCondition = await DummyPaymentSpendingCondition.new();
    });

    describe('spendingConditions', () => {
        it('should receive empty contract address when pair (outputType, spendingTx) not registered', async () => {
            expect(await this.registry.spendingConditions(1, 1)).to.equal(constants.ZERO_ADDRESS);
        });
    });

    describe('registerSpendingCondition', () => {
        it('should be able to register successfully', async () => {
            const outputType = 1;
            const spendingTxType = 123;
            await this.registry.registerSpendingCondition(
                outputType, spendingTxType, this.dummyCondition.address,
            );
            expect(await this.registry.spendingConditions(outputType, spendingTxType))
                .to.equal(this.dummyCondition.address);
        });

        it('should reject when not registered by operator', async () => {
            await expectRevert(
                this.registry.registerSpendingCondition(
                    1, 1, this.dummyCondition.address, { from: other },
                ),
                'Not being called by operator',
            );
        });

        it('should reject when frozen', async () => {
            await this.registry.freeze();
            await expectRevert(
                this.registry.registerSpendingCondition(1, 1, this.dummyCondition.address),
                'The function has been frozen',
            );
        });

        it('should reject when trying to register with spending tx type 0', async () => {
            const outputType = 1;
            const spendingTxType = 0;
            await expectRevert(
                this.registry.registerSpendingCondition(outputType, spendingTxType, constants.ZERO_ADDRESS),
                'Transaction Type must not be 0',
            );
        });

        it('should NOT reject when trying to register with output type 0', async () => {
            const outputType = 0;
            const spendingTxType = 123;
            await this.registry.registerSpendingCondition(
                outputType, spendingTxType, this.dummyCondition.address,
            );
            expect(await this.registry.spendingConditions(outputType, spendingTxType))
                .to.equal(this.dummyCondition.address);
        });

        it('should reject when trying to register with an empty address', async () => {
            await expectRevert(
                this.registry.registerSpendingCondition(1, 1, constants.ZERO_ADDRESS),
                'Should not register an empty address',
            );
        });

        it('should reject when the pair of (output type, spending tx type) is already registered', async () => {
            const outputType = 1;
            const spendingTxType = 123;
            const secondDummyConditionAddress = (await DummyPaymentSpendingCondition.new()).address;
            await this.registry.registerSpendingCondition(outputType, spendingTxType, this.dummyCondition.address);
            await expectRevert(
                this.registry.registerSpendingCondition(outputType, spendingTxType, secondDummyConditionAddress),
                'This (output type, spending tx type) pair has already been registered',
            );
        });
    });
});
