const IsDeposit = artifacts.require('IsDepositWrapper');

const { expect } = require('chai');

contract('IsDeposit', () => {
    const CHILD_BLOCK_INTERVAL = 1000;

    before('setup', async () => {
        this.contract = await IsDeposit.new(CHILD_BLOCK_INTERVAL);
    });

    describe('test', () => {
        it('should return true when it is a deposit block', async () => {
            expect(await this.contract.test(1)).to.be.true;
        });

        it('should return false when it is not a deposit block', async () => {
            expect(await this.contract.test(CHILD_BLOCK_INTERVAL)).to.be.false;
        });
    });
});
