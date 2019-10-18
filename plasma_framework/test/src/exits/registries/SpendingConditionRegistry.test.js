const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const SpendingCondition = artifacts.require('SpendingConditionMock');

const { constants, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('SpendingConditionRegistry', ([_, other]) => {
    beforeEach(async () => {
        this.dummyCondition = await SpendingCondition.new();
        this.registry = await SpendingConditionRegistry.new();
    });

    describe('spendingConditions', () => {
        it('should get empty address if not registered', async () => {
            const nonRegisteredOutputType = 999;
            const nonRegisteredSpendingTxType = 123;
            const condition = await this.registry.spendingConditions(
                nonRegisteredOutputType, nonRegisteredSpendingTxType,
            );
            expect(condition).to.equal(constants.ZERO_ADDRESS);
        });
    });

    describe('registerSpendingCondition', () => {
        it('should be able to register successfully', async () => {
            const outputType = 1;
            const txType = 2;
            await this.registry.registerSpendingCondition(outputType, txType, this.dummyCondition.address);
            expect(await this.registry.spendingConditions(outputType, txType)).to.equal(this.dummyCondition.address);
        });

        it('should reject when not registered by owner', async () => {
            const outputType = 1;
            const txType = 2;
            await expectRevert(
                this.registry.registerSpendingCondition(
                    outputType, txType, this.dummyCondition.address, { from: other },
                ),
                'Ownable: caller is not the owner',
            );
        });

        it('should not be able to register after renouncing the ownership', async () => {
            const outputType = 1;
            const txType = 2;
            await this.registry.renounceOwnership();
            await expectRevert(
                this.registry.registerSpendingCondition(
                    outputType, txType, this.dummyCondition.address, { from: other },
                ),
                'Ownable: caller is not the owner',
            );
        });

        it('should reject when trying to register with output type 0', async () => {
            const outputType = 0;
            const txType = 2;
            await expectRevert(
                this.registry.registerSpendingCondition(
                    outputType, txType, this.dummyCondition.address,
                ),
                'Registration not possible with output type 0',
            );
        });

        it('should reject when trying to register with spending tx type 0', async () => {
            const outputType = 1;
            const txType = 0;
            await expectRevert(
                this.registry.registerSpendingCondition(
                    outputType, txType, this.dummyCondition.address,
                ),
                'Registration not possible with spending tx type 0',
            );
        });

        it('should reject when trying to register with an empty address', async () => {
            await expectRevert(
                this.registry.registerSpendingCondition(1, 1, constants.ZERO_ADDRESS),
                'Registration not possible with an empty address',
            );
        });

        it('should reject when the (output type, spending tx type) pair is already registered', async () => {
            const outputType = 1;
            const txType = 2;
            const secondDummyCondition = (await SpendingCondition.new());
            await this.registry.registerSpendingCondition(outputType, txType, this.dummyCondition.address);
            await expectRevert(
                this.registry.registerSpendingCondition(outputType, txType, secondDummyCondition.address),
                'The (output type, spending tx type) pair is already registered',
            );
        });
    });
});
