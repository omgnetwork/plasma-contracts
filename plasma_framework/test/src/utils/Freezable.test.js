const Freezable = artifacts.require('FreezableMock');

const { expectRevert, expectEvent } = require('openzeppelin-test-helpers');

contract('Freezable', () => {
    const CHILD_BLOCK_INTERVAL = 1000;

    beforeEach('setup', async () => {
        this.contract = await Freezable.new();
    });

    describe('onlyNonFrozen', () => {
        it('should reject the call when frozen', async () => {
            await this.contract.freeze();
            await expectRevert(
                this.contract.checkOnlyNotFrozen(),
                'The function has been frozen',
            );
        });

        it('should pass when the call is not frozen', async () => {
            const { receipt } = await this.contract.checkOnlyNotFrozen();
            await expectEvent.inTransaction(
                receipt.transactionHash,
                Freezable,
                'OnlyNonFrozenChecked',
                {},
            );
        });
    });
});
