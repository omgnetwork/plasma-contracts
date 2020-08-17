const ExitBounty = artifacts.require('ExitBountyWrapper');
const { BN } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('ExitBounty', () => {
    const GAS_USED_PROCESS_EXIT = 107000; // approx gas usage of processExit
    const GAS_SPLIT_PER_PIGGYBACK = 500000; // approx gas usage split per piggyback

    before('setup', async () => {
        this.contract = await ExitBounty.new();
    });

    describe('calculate process standard exit bounty', () => {
        it('should return the correct bounty for a gas price of 10 gwei', async () => {
            const gasPrice = new BN('10000000000');
            const expectedSize = gasPrice.mul(new BN(GAS_USED_PROCESS_EXIT));
            expect(await this.contract.processStandardExitBountySize(gasPrice))
                .to.be.bignumber.equal(expectedSize);
        });

        it('should return the correct bounty for a gas price of 80 gwei', async () => {
            const gasPrice = new BN('80000000000');
            const expectedSize = gasPrice.mul(new BN(GAS_USED_PROCESS_EXIT));
            expect(await this.contract.processStandardExitBountySize(gasPrice))
                .to.be.bignumber.equal(expectedSize);
        });
    });

    describe('calculate process in-flight exit bounty', () => {
        it('should return the correct bounty for a gas price of 10 gwei', async () => {
            const gasPrice = new BN('10000000000');
            const expectedSize = gasPrice.mul(new BN(GAS_SPLIT_PER_PIGGYBACK));
            expect(await this.contract.processInFlightExitBountySize(gasPrice))
                .to.be.bignumber.equal(expectedSize);
        });

        it('should return the correct bounty for a gas price of 80 gwei', async () => {
            const gasPrice = new BN('80000000000');
            const expectedSize = gasPrice.mul(new BN(GAS_SPLIT_PER_PIGGYBACK));
            expect(await this.contract.processInFlightExitBountySize(gasPrice))
                .to.be.bignumber.equal(expectedSize);
        });
    });
});
