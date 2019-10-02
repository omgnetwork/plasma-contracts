const BondSizeMock = artifacts.require('BondSizeMock');
const { BN, expectRevert, time } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('BondSize', () => {
    const WAITING_PERIOD = time.duration.days(2);
    const HALF_WAITING_PERIOD = WAITING_PERIOD.divn(2);

    describe('in general...', () => {
        beforeEach(async () => {
            this.initialBondSize = new BN(20000000000);
            this.lowerBoundDivisor = 2;
            this.upperBoundMultiplier = 3;
            this.contract = await BondSizeMock.new(
                this.initialBondSize,
                this.lowerBoundDivisor,
                this.upperBoundMultiplier,
            );
        });

        it('should return the initial bond size', async () => {
            const bondSize = await this.contract.bondSize();
            expect(bondSize).to.be.bignumber.equal(this.initialBondSize);
        });

        it('should be able to update the bond to upperBoundMultiplier times its current value', async () => {
            const newBondSize = new BN(this.initialBondSize).muln(this.upperBoundMultiplier);
            await this.contract.updateBondSize(newBondSize);
        });

        it('should fail to update bond to more than upperBoundMultiplier times its current value', async () => {
            const newBondSize = new BN(this.initialBondSize).muln(this.upperBoundMultiplier).addn(1);
            await expectRevert(
                this.contract.updateBondSize(newBondSize),
                'Bond size is too high',
            );
        });

        it('should be able to update the bond to lowerBoundDivisor of its current value', async () => {
            const newBondSize = new BN(this.initialBondSize).divn(this.lowerBoundDivisor);
            await this.contract.updateBondSize(newBondSize);
        });

        it('should fail to update bond to less than lowerBoundDivisor of its current value', async () => {
            const newBondSize = new BN(this.initialBondSize).divn(this.lowerBoundDivisor).subn(1);
            await expectRevert(
                this.contract.updateBondSize(newBondSize),
                'Bond size is too low',
            );
        });

        it('should not update the actual bond value until after the waiting period', async () => {
            const newBondSize = new BN(this.initialBondSize).muln(2);
            await this.contract.updateBondSize(newBondSize);

            await time.increase(WAITING_PERIOD.sub(time.duration.seconds(5)));
            const bondSize = await this.contract.bondSize();
            expect(bondSize).to.be.bignumber.equal(this.initialBondSize);
        });

        it('should update the actual bond value after the waiting period', async () => {
            const newBondSize = new BN(this.initialBondSize).muln(2);
            await this.contract.updateBondSize(newBondSize);

            await time.increase(WAITING_PERIOD);
            const bondSize = await this.contract.bondSize();
            expect(bondSize).to.be.bignumber.equal(newBondSize);
        });

        it('should update the actual bond value after the waiting period', async () => {
            const newBondSize = new BN(this.initialBondSize).muln(2);
            await this.contract.updateBondSize(newBondSize);

            // Wait half the waiting period
            await time.increase(HALF_WAITING_PERIOD);

            // Update again while the first update is in progress.
            const secondNewBondSize = new BN(this.initialBondSize).muln(1.5);
            await this.contract.updateBondSize(secondNewBondSize);

            // Wait half the waiting period again.
            await time.increase(HALF_WAITING_PERIOD);
            // Even though the first update's waiting period is over, the second
            // update is in progress so the bond size should not have changed yet.
            let bondSize = await this.contract.bondSize();
            expect(bondSize).to.be.bignumber.equal(this.initialBondSize);

            // Wait the remaining waiting period
            await time.increase(HALF_WAITING_PERIOD);
            bondSize = await this.contract.bondSize();
            expect(bondSize).to.be.bignumber.equal(secondNewBondSize);
        });

        it('should be able to update continuosly', async () => {
            const newBondSize1 = new BN(this.initialBondSize).muln(2);
            await this.contract.updateBondSize(newBondSize1);
            await time.increase(WAITING_PERIOD);

            let bondSize = await this.contract.bondSize();
            expect(bondSize).to.be.bignumber.equal(newBondSize1);

            const newBondSize2 = newBondSize1.muln(2);
            await this.contract.updateBondSize(newBondSize2);

            // Before a full waiting period is finished, it would still not update to latest
            await time.increase(HALF_WAITING_PERIOD);
            bondSize = await this.contract.bondSize();
            expect(bondSize, 'should not update to latest yet').to.be.bignumber.equal(newBondSize1);

            // update to latest after full waiting period is done
            await time.increase(HALF_WAITING_PERIOD);
            bondSize = await this.contract.bondSize();
            expect(bondSize, 'should update to latest').to.be.bignumber.equal(newBondSize2);
        });
    });

    describe('with boundary size of numbers', () => {
        it('should able to update to max number of uint128 without having overflow issue', async () => {
            const maxSizeOfUint256 = (new BN(2)).pow(new BN(128)).sub(new BN(1)); // 2^128 - 1

            const initialBondSize = maxSizeOfUint256.sub(new BN(10000));
            const lowerBoundDivisor = 2;
            const upperBoundMultiplier = 3;
            const contract = await BondSizeMock.new(
                initialBondSize,
                lowerBoundDivisor,
                upperBoundMultiplier,
            );

            await contract.updateBondSize(maxSizeOfUint256);
            await time.increase(WAITING_PERIOD);
            const bondSize = await contract.bondSize();
            expect(bondSize).to.be.bignumber.equal(maxSizeOfUint256);
        });

        it('should be able to update to 1', async () => {
            const initialBondSize = new BN(2);
            const lowerBoundDivisor = 2;
            const upperBoundMultiplier = 3;
            const contract = await BondSizeMock.new(
                initialBondSize,
                lowerBoundDivisor,
                upperBoundMultiplier,
            );
            const bondSizeOne = new BN(1);

            await contract.updateBondSize(bondSizeOne);
            await time.increase(WAITING_PERIOD);
            const bondSize = await contract.bondSize();
            expect(bondSize).to.be.bignumber.equal(bondSizeOne);
        });

        it('should NOT be able to update to 0', async () => {
            const initialBondSize = new BN(2);
            const lowerBoundDivisor = 2;
            const upperBoundMultiplier = 3;
            const contract = await BondSizeMock.new(
                initialBondSize,
                lowerBoundDivisor,
                upperBoundMultiplier,
            );
            const bondSizeZero = new BN(0);

            await expectRevert(
                contract.updateBondSize(bondSizeZero),
                'Bond size cannot be zero',
            );
        });
    });
});
