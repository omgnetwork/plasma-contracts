const PaymentOutputGuardHandler = artifacts.require('PaymentOutputGuardHandler');

const { expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');


contract('PaymentOutputGuardHandler', ([alice]) => {
    beforeEach('setup contracts', async () => {
        this.handler = await PaymentOutputGuardHandler.new();
    });

    describe('isValid', () => {
        it('should fail when preimage is not empty', async () => {
            const nonEmptyPreimage = '0x11';
            const args = [alice, nonEmptyPreimage];

            await expectRevert(
                this.handler.isValid(args),
                'Pre-image of the output guard should be empty',
            );
        });

        it('should return true when succeed', async () => {
            const preimage = '0x';
            const args = [alice, preimage];
            expect(await this.handler.isValid(args)).to.be.true;
        });
    });

    describe('getExitTarget', () => {
        it('should return the owner information directly from outputGuard field', async () => {
            const preimage = '0x';
            const args = [alice, preimage];
            expect(await this.handler.getExitTarget(args)).to.equal(alice);
        });
    });
});
