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
        it('should receive empty contract address when pair (outputType, consumeTx) not registered', async () => {
            expect(await this.registry.spendingConditions(1, 1)).to.equal(constants.ZERO_ADDRESS);
        });
    });

    describe('registerSpendingCondition', () => {
        it('should be able to register successfully', async () => {
            const outputType = 1;
            const consumeTxType = 123;
            await this.registry.registerSpendingCondition(
                outputType, consumeTxType, this.dummyCondition.address,
            );
            expect(await this.registry.spendingConditions(outputType, consumeTxType))
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

        it('should reject when trying to register with consume tx type 0', async () => {
            const outputType = 1;
            const consumeTxType = 0;
            await expectRevert(
                this.registry.registerSpendingCondition(outputType, consumeTxType, constants.ZERO_ADDRESS),
                'Transaction Type would never be 0',
            );
        });

        it('should NOT reject when trying to register with output type 0', async () => {
            const outputType = 0;
            const consumeTxType = 123;
            await this.registry.registerSpendingCondition(
                outputType, consumeTxType, this.dummyCondition.address,
            );
            expect(await this.registry.spendingConditions(outputType, consumeTxType))
                .to.equal(this.dummyCondition.address);
        });

        it('should reject when trying to register with an empty address', async () => {
            await expectRevert(
                this.registry.registerSpendingCondition(1, 1, constants.ZERO_ADDRESS),
                'Should not register an empty address',
            );
        });

        it('should reject when the pair of (output type, consume tx type) is already registered', async () => {
            const outputType = 1;
            const consumeTxType = 123;
            const secondDummyConditionAddress = (await DummyPaymentSpendingCondition.new()).address;
            await this.registry.registerSpendingCondition(outputType, consumeTxType, this.dummyCondition.address);
            await expectRevert(
                this.registry.registerSpendingCondition(outputType, consumeTxType, secondDummyConditionAddress),
                'Such (output type, consume tx type) pair has already been registered',
            );
        });
    });
});
