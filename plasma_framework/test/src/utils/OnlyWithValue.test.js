const OnlyWithValue = artifacts.require('OnlyWithValueMock');

const { expectRevert, expectEvent } = require('openzeppelin-test-helpers');

contract('OnlyWithValue', () => {
    beforeEach(async () => {
        this.contract = await OnlyWithValue.new();
    });

    describe('onlyWithValue', () => {
        it('should accept call when the value matches', async () => {
            const testValue = 100;
            const { receipt } = await this.contract.checkOnlyWithValue(testValue, { value: testValue });
            await expectEvent.inTransaction(
                receipt.transactionHash,
                OnlyWithValue,
                'OnlyWithValuePassed',
                {},
            );
        });

        it('should reject call when value mismatches', async () => {
            await expectRevert(
                this.contract.checkOnlyWithValue(100, { value: 200 }),
                'Input value mismatches with msg.value',
            );
        });
    });
});
