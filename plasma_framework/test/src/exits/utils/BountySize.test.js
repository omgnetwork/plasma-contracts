const ExitBountyMock = artifacts.require('ExitBountyMock');
const { BN, expectRevert, time } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('ExitBounty', () => {
    const WAITING_PERIOD = time.duration.days(2);
    const HALF_WAITING_PERIOD = WAITING_PERIOD.divn(2);

    describe('with normal cases', () => {
        beforeEach(async () => {
            this.initialExitBountySize = new BN(20000000000);
            this.lowerBoundDivisor = 2;
            this.upperBoundMultiplier = 2;
            this.contract = await ExitBountyMock.new(
                this.initialExitBountySize,
                this.lowerBoundDivisor,
                this.upperBoundMultiplier,
            );
        });

        it('should return the initial exit bounty size', async () => {
            const exitBountySize = await this.contract.exitBountySize();
            expect(exitBountySize).to.be.bignumber.equal(this.initialExitBountySize);
        });

        it('should be able to update the exit bounty to upperBoundMultiplier times its current value', async () => {
            const newExitBountySize = new BN(this.initialExitBountySize).muln(this.upperBoundMultiplier);
            await this.contract.updateExitBountySize(newExitBountySize);
        });

        it('should fail to update exit bounty to more than upperBoundMultiplier times its current value', async () => {
            const newExitBountySize = new BN(this.initialExitBountySize).muln(this.upperBoundMultiplier).addn(1);
            await expectRevert(
                this.contract.updateExitBountySize(newExitBountySize),
                'Bounty size is too high',
            );
        });

        it('should be able to update the exit bounty to lowerBoundDivisor of its current value', async () => {
            const newExitBountySize = new BN(this.initialExitBountySize).divn(this.lowerBoundDivisor);
            await this.contract.updateExitBountySize(newExitBountySize);
        });

        it('should fail to update exit bounty to less than lowerBoundDivisor of its current value', async () => {
            const newExitBountySize = new BN(this.initialExitBountySize).divn(this.lowerBoundDivisor).subn(1);
            await expectRevert(
                this.contract.updateExitBountySize(newExitBountySize),
                'Bounty size is too low',
            );
        });

        it('should not update the actual exit bounty value until after the waiting period', async () => {
            const newExitBountySize = new BN(this.initialExitBountySize).muln(2);
            await this.contract.updateExitBountySize(newExitBountySize);

            await time.increase(WAITING_PERIOD.sub(time.duration.seconds(5)));
            const exitBountySize = await this.contract.exitBountySize();
            expect(exitBountySize).to.be.bignumber.equal(this.initialExitBountySize);
        });

        it('should update the actual exit bounty value after the waiting period', async () => {
            const newExitBountySize = new BN(this.initialExitBountySize).muln(2);
            await this.contract.updateExitBountySize(newExitBountySize);

            await time.increase(WAITING_PERIOD);
            const exitBountySize = await this.contract.exitBountySize();
            expect(exitBountySize).to.be.bignumber.equal(newExitBountySize);
        });

        it('should update the actual exit bounty value only after the waiting period', async () => {
            const newExitBountySize = new BN(this.initialExitBountySize).muln(2);
            await this.contract.updateExitBountySize(newExitBountySize);

            // Wait half the waiting period
            await time.increase(HALF_WAITING_PERIOD);

            // Update again while the first update is in progress.
            const secondNewExitBountySize = new BN(this.initialExitBountySize).muln(1.5);
            await this.contract.updateExitBountySize(secondNewExitBountySize);

            // Wait half the waiting period again.
            await time.increase(HALF_WAITING_PERIOD);
            // Even though the first update's waiting period is over, the second
            // update is in progress so the exit bounty size should not have changed yet.
            let exitBountySize = await this.contract.exitBountySize();
            expect(exitBountySize).to.be.bignumber.equal(this.initialExitBountySize);

            // Wait the remaining waiting period
            await time.increase(HALF_WAITING_PERIOD);
            exitBountySize = await this.contract.exitBountySize();
            expect(exitBountySize).to.be.bignumber.equal(secondNewExitBountySize);
        });

        it('should be able to update continuosly', async () => {
            const newExitBountySize1 = new BN(this.initialExitBountySize).muln(2);
            await this.contract.updateExitBountySize(newExitBountySize1);
            await time.increase(WAITING_PERIOD);

            let exitBountySize = await this.contract.exitBountySize();
            expect(exitBountySize).to.be.bignumber.equal(newExitBountySize1);

            const newExitBountySize2 = newExitBountySize1.muln(2);
            await this.contract.updateExitBountySize(newExitBountySize2);

            // Before a full waiting period is finished, it would still not update to latest
            await time.increase(HALF_WAITING_PERIOD);
            exitBountySize = await this.contract.exitBountySize();
            expect(exitBountySize, 'should not update to latest yet').to.be.bignumber.equal(newExitBountySize1);

            // update to latest after full waiting period is done
            await time.increase(HALF_WAITING_PERIOD);
            exitBountySize = await this.contract.exitBountySize();
            expect(exitBountySize, 'should update to latest').to.be.bignumber.equal(newExitBountySize2);
        });
    });

    describe('with boundary size of numbers', () => {
        it('should able to update to max number of uint128 without having overflow issue', async () => {
            const maxSizeOfUint128 = (new BN(2)).pow(new BN(128)).sub(new BN(1)); // 2^128 - 1

            const initialExitBountySize = maxSizeOfUint128.sub(new BN(10000));
            const lowerBoundDivisor = 2;
            const upperBoundMultiplier = 2;
            const contract = await ExitBountyMock.new(
                initialExitBountySize,
                lowerBoundDivisor,
                upperBoundMultiplier,
            );

            await contract.updateExitBountySize(maxSizeOfUint128);
            await time.increase(WAITING_PERIOD);
            const exitBountySize = await contract.exitBountySize();
            expect(exitBountySize).to.be.bignumber.equal(maxSizeOfUint128);
        });

        it('should be able to update to 1 from 2', async () => {
            const initialExitBountySize = new BN(2);
            const lowerBoundDivisor = 2;
            const upperBoundMultiplier = 2;
            const contract = await ExitBountyMock.new(
                initialExitBountySize,
                lowerBoundDivisor,
                upperBoundMultiplier,
            );
            const exitBountySizeOne = new BN(1);

            await contract.updateExitBountySize(exitBountySizeOne);
            await time.increase(WAITING_PERIOD);
            const exitBountySize = await contract.exitBountySize();
            expect(exitBountySize).to.be.bignumber.equal(exitBountySizeOne);
        });

        it('should NOT be able to update to 0', async () => {
            const initialExitBountySize = new BN(2);
            const lowerBoundDivisor = 2;
            const upperBoundMultiplier = 2;
            const contract = await ExitBountyMock.new(
                initialExitBountySize,
                lowerBoundDivisor,
                upperBoundMultiplier,
            );
            const exitBountySizeZero = new BN(0);

            await expectRevert(
                contract.updateExitBountySize(exitBountySizeZero),
                'Bounty size cannot be zero',
            );
        });
    });
});
