const ExitBounty = artifacts.require('ExitBountyWrapper');
const { BN } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('ExitBounty', () => {
    const GAS_USED_PROCESS_EXIT = 107000; // approx gas usage of processExit

    before('setup', async () => {
        this.contract = await ExitBounty.new();
    });

    describe('calculate process standard exit bounty', () => {
        it('should return the correct bounty for a gas price of 10 gwei', async () => {
            const gasPrice = 10000000000;
            expect(await this.contract.processStandardExitBountySize({ gasPrice }))
                .to.be.bignumber.equal(new BN(GAS_USED_PROCESS_EXIT * gasPrice));
        });

        it('should return the correct bounty for a gas price of 80 gwei', async () => {
            const gasPrice = 80000000000;
            expect(await this.contract.processStandardExitBountySize({ gasPrice }))
                .to.be.bignumber.equal(new BN(GAS_USED_PROCESS_EXIT * gasPrice));
        });
    });
});
