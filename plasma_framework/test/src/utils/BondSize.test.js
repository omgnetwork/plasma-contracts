const BondSizeMock = artifacts.require('BondSizeMock');
const { BN, expectRevert, time } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('BondSize', () => {
    const WAITING_PERIOD = time.duration.days(2);
    const HALF_WAITING_PERIOD = WAITING_PERIOD.divn(2);

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

        await time.increase(WAITING_PERIOD.sub(time.duration.seconds(1)));
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
});
