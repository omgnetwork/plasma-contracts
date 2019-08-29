const BondSizeMock = artifacts.require('BondSizeMock');
const { BN, expectRevert, time } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract.only('BondSize', () => {
    beforeEach(async () => {
        this.initialBondSize = new BN(20000000000);
        this.contract = await BondSizeMock.new(
            this.initialBondSize,
        );
    });

    it('should return the initial bond size', async () => {
        const bondSize = await this.contract.bondSize();
        expect(bondSize).to.be.bignumber.equal(this.initialBondSize);
    });

    it('should be able to update the bond to 2x its current value', async () => {
        const newBondSize = new BN(this.initialBondSize).muln(2);
        await this.contract.updateBondSize(newBondSize);
    });

    it('should fail to update bond to more than 2x its current value', async () => {
        const newBondSize = new BN(this.initialBondSize).muln(2.1);
        await expectRevert(
            this.contract.updateBondSize(newBondSize),
            'Bond size too high',
        );
    });

    it('should be able to update the bond to half of its current value', async () => {
        const newBondSize = new BN(this.initialBondSize).divn(2);
        await this.contract.updateBondSize(newBondSize);
    });

    it('should fail to update bond to less than half of its current value', async () => {
        const newBondSize = new BN(this.initialBondSize).divn(2.1);
        await expectRevert(
            this.contract.updateBondSize(newBondSize),
            'Bond size too low',
        );
    });

    it('should not update the actual bond value until after the waiting period', async () => {
        const newBondSize = new BN(this.initialBondSize).muln(2);
        await this.contract.updateBondSize(newBondSize);

        await time.increase(time.duration.days(2).sub(time.duration.seconds(1)));
        const bondSize = await this.contract.bondSize();
        expect(bondSize).to.be.bignumber.equal(this.initialBondSize);
    });

    it('should update the actual bond value after the waiting period', async () => {
        const newBondSize = new BN(this.initialBondSize).muln(2);
        await this.contract.updateBondSize(newBondSize);

        await time.increase(time.duration.days(2));
        const bondSize = await this.contract.bondSize();
        expect(bondSize).to.be.bignumber.equal(newBondSize);
    });

    it('should update the actual bond value after the waiting period', async () => {
        const newBondSize = new BN(this.initialBondSize).muln(2);
        await this.contract.updateBondSize(newBondSize);

        // Wait half the waiting period
        await time.increase(time.duration.days(1));

        // Update again while the first update is in progress.
        const secondNewBondSize = new BN(this.initialBondSize).muln(1.5);
        await this.contract.updateBondSize(secondNewBondSize);

        // Wait half the waiting period again.
        await time.increase(time.duration.days(1));
        // Even though the first update's waiting period is over, the second
        // update is in progress so the bond size should not have changed yet.
        let bondSize = await this.contract.bondSize();
        expect(bondSize).to.be.bignumber.equal(this.initialBondSize);

        // Wait the remaining waiting period
        await time.increase(time.duration.days(1));
        bondSize = await this.contract.bondSize();
        expect(bondSize).to.be.bignumber.equal(secondNewBondSize);
    });
});
