const ExitPriority = artifacts.require('ExitPriorityWrapper');

const { BN } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('ExitPriority', () => {
    beforeEach(async () => {
        this.contract = await ExitPriority.new();
    });

    describe('computePriority', () => {
        it('should be positive correlative with "exitableAt" input given same nonce', async () => {
            const exitableAt1 = 1;
            const exitableAt2 = 2;
            const nonce = 1;
            const priority1 = await this.contract.computePriority(exitableAt1, nonce);
            const priority2 = await this.contract.computePriority(exitableAt2, nonce);
            expect(priority1).to.be.a.bignumber.that.is.lessThan(priority2);
        });

        it('should be positive correlative with "exitableAt" input even given nonce negatively correlated', async () => {
            const exitableAt1 = 1;
            const exitableAt2 = 2;
            const nonce1 = 2;
            const nonce2 = 1;
            const priority1 = await this.contract.computePriority(exitableAt1, nonce1);
            const priority2 = await this.contract.computePriority(exitableAt2, nonce2);
            expect(priority1).to.be.a.bignumber.that.is.lessThan(priority2);
        });
    });

    describe('parseExitableAt', () => {
        it('should be able to parse the "exitableAt" data out from priority given nonce is 0', async () => {
            const exitableAt = 123;
            const nonce = 0;
            const priority = await this.contract.computePriority(exitableAt, nonce);
            const parsedExitableAt = await this.contract.parseExitableAt(priority);
            expect(parsedExitableAt).to.be.bignumber.equal(new BN(exitableAt));
        });

        it('should be able to parse the "exitableAt" data out from priority given max nonce value', async () => {
            const exitableAt = 123;
            const nonce = (new BN(2)).pow(new BN(64)).sub(new BN(1)); // 2^64 - 1
            const priority = await this.contract.computePriority(exitableAt, nonce);
            const parsedExitableAt = await this.contract.parseExitableAt(priority);
            expect(parsedExitableAt).to.be.bignumber.equal(new BN(exitableAt));
        });

        it('should be able to parse the "exitableAt" data out from priority given exitable timestamp is 0', async () => {
            const exitableAt = 0;
            const nonce = 123;
            const priority = await this.contract.computePriority(exitableAt, nonce);
            const parsedExitableAt = await this.contract.parseExitableAt(priority);
            expect(parsedExitableAt).to.be.bignumber.equal(new BN(exitableAt));
        });

        it('should be able to parse the "exitableAt" data out from priority given max exitable timestamp of uint64', async () => {
            const exitableAt = (new BN(2)).pow(new BN(64)).sub(new BN(1)); // 2^64 - 1
            const nonce = 123;
            const priority = await this.contract.computePriority(exitableAt, nonce);
            const parsedExitableAt = await this.contract.parseExitableAt(priority);
            expect(parsedExitableAt).to.be.bignumber.equal(exitableAt);
        });
    });
});
