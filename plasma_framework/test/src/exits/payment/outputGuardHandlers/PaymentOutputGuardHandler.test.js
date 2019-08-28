const PaymentOutputGuardHandler = artifacts.require('PaymentOutputGuardHandler');

const { expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { addressToOutputGuard } = require('../../../../helpers/utils.js');


contract('PaymentOutputGuardHandler', ([alice]) => {
    const TEST_OUTPUT_TYPE = 1;

    beforeEach('setup contracts', async () => {
        this.handler = await PaymentOutputGuardHandler.new(TEST_OUTPUT_TYPE);
    });

    describe('isValid', () => {
        it('should fail when preimage is not empty', async () => {
            const nonEmptyPreimage = '0x11';
            const guard = addressToOutputGuard(alice);
            const args = [guard, TEST_OUTPUT_TYPE, nonEmptyPreimage];

            await expectRevert(
                this.handler.isValid(args),
                'Pre-imgage of the output guard should be empty',
            );
        });

        it('should fail when output type mismatch', async () => {
            const preimage = '0x';
            const mismatchOutputType = TEST_OUTPUT_TYPE + 1;
            const guard = addressToOutputGuard(alice);
            const args = [guard, mismatchOutputType, preimage];

            await expectRevert(
                this.handler.isValid(args),
                'Output type mismatch',
            );
        });

        it('should return true when succeed', async () => {
            const preimage = '0x';
            const guard = addressToOutputGuard(alice);
            const args = [guard, TEST_OUTPUT_TYPE, preimage];
            expect(await this.handler.isValid(args)).to.be.true;
        });
    });

    describe('getExitTarget', () => {
        it('should return the owner information directly from outputGuard field', async () => {
            const preimage = '0x';
            const guard = addressToOutputGuard(alice);
            const args = [guard, TEST_OUTPUT_TYPE, preimage];
            expect(await this.handler.getExitTarget(args)).to.equal(alice);
        });
    });
});
