const BondSizeMock = artifacts.require('BondSizeMock');
const { BN, expectRevert, time } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('BondSize', () => {
    const WAITING_PERIOD = time.duration.days(2);
    const HALF_WAITING_PERIOD = WAITING_PERIOD.divn(2);

    describe('while initializing the bond size', () => {
        it('should fail initializing when the bounty size is incorrect', async () => {
            this.initialBondSize = new BN(20000000000);
            this.initialExitBountySize = new BN(20000000001);
            this.lowerBoundDivisor = 2;
            this.upperBoundMultiplier = 3;
            await expectRevert(
                BondSizeMock.new(
                    this.initialBondSize,
                    this.initialExitBountySize,
                    this.lowerBoundDivisor,
                    this.upperBoundMultiplier,
                ),
                'Incorrect Exit Bounty Size',
            );
        });
    });

    describe('with normal cases', () => {
        beforeEach(async () => {
            this.initialBondSize = new BN(20000000000);
            this.initialExitBountySize = new BN(5000000000);
            this.lowerBoundDivisor = 2;
            this.upperBoundMultiplier = 3;
            this.contract = await BondSizeMock.new(
                this.initialBondSize,
                this.initialExitBountySize,
                this.lowerBoundDivisor,
                this.upperBoundMultiplier,
            );
        });

        it('should return the initial bond size', async () => {
            const bondSize = await this.contract.bondSize();
            expect(bondSize).to.be.bignumber.equal(this.initialBondSize);
        });

        it('should return the initial bounty size reserved from the bond', async () => {
            const bountySize = await this.contract.bountySize();
            expect(bountySize).to.be.bignumber.equal(this.initialExitBountySize);
        });

        describe('while updating only the Bond size', () => {
            it('should be able to update the bond to upperBoundMultiplier times its current value', async () => {
                const newBondSize = new BN(this.initialBondSize).muln(this.upperBoundMultiplier);
                await this.contract.updateBondSize(newBondSize, this.initialExitBountySize);
            });

            it('should fail to update bond to more than upperBoundMultiplier times its current value', async () => {
                const newBondSize = new BN(this.initialBondSize).muln(this.upperBoundMultiplier).addn(1);
                await expectRevert(
                    this.contract.updateBondSize(newBondSize, this.initialExitBountySize),
                    'Bond size is too high',
                );
            });

            it('should be able to update the bond to lowerBoundDivisor of its current value', async () => {
                const newBondSize = new BN(this.initialBondSize).divn(this.lowerBoundDivisor);
                await this.contract.updateBondSize(newBondSize, this.initialExitBountySize);
            });

            it('should fail to update bond to less than lowerBoundDivisor of its current value', async () => {
                const newBondSize = new BN(this.initialBondSize).divn(this.lowerBoundDivisor).subn(1);
                await expectRevert(
                    this.contract.updateBondSize(newBondSize, this.initialExitBountySize),
                    'Bond size is too low',
                );
            });
        });

        describe('while adjusting the bounty size from the bond', () => {
            it('should be able to update the bounty to a value lesser than the bond', async () => {
                const newBountySize = new BN(this.initialBondSize).subn(1);
                await this.contract.updateBondSize(this.initialBondSize, newBountySize);
            });

            it('should be able to update the bounty to a value equal the bond', async () => {
                await this.contract.updateBondSize(this.initialBondSize, this.initialBondSize);
            });

            it('should fail to update bounty to value more than the current bond', async () => {
                const newBountySize = new BN(this.initialBondSize).addn(1);
                await expectRevert(
                    this.contract.updateBondSize(this.initialBondSize, newBountySize),
                    'Incorrect Exit Bounty Size',
                );
            });
        });

        describe('while updating both the Bond and Bounty size', () => {
            it('should be able to update the bond when bounty size is valid', async () => {
                const newBondSize = new BN(this.initialBondSize).muln(this.upperBoundMultiplier);
                const newBountySize = newBondSize.subn(1);
                await this.contract.updateBondSize(newBondSize, newBountySize);
            });

            it('should fail to update bond if the bounty value is incorrect', async () => {
                const newBondSize = new BN(this.initialBondSize).muln(this.upperBoundMultiplier);
                const newBountySize = newBondSize.addn(1);
                await expectRevert(
                    this.contract.updateBondSize(newBondSize, newBountySize),
                    'Incorrect Exit Bounty Size',
                );
            });
        });

        it('should not update the actual bond value until after the waiting period', async () => {
            const newBondSize = new BN(this.initialBondSize).muln(2);
            const newBountySize = new BN(this.initialExitBountySize).addn(1000);
            await this.contract.updateBondSize(newBondSize, newBountySize);

            await time.increase(WAITING_PERIOD.sub(time.duration.seconds(5)));
            const bondSize = await this.contract.bondSize();
            const bountySize = await this.contract.bountySize();
            expect(bondSize).to.be.bignumber.equal(this.initialBondSize);
            expect(bountySize).to.be.bignumber.equal(this.initialExitBountySize);
        });

        it('should update the actual bond value after the waiting period', async () => {
            const newBondSize = new BN(this.initialBondSize).muln(2);
            const newBountySize = new BN(this.initialExitBountySize).addn(1000);
            await this.contract.updateBondSize(newBondSize, newBountySize);

            await time.increase(WAITING_PERIOD);
            const bondSize = await this.contract.bondSize();
            const bountySize = await this.contract.bountySize();
            expect(bondSize).to.be.bignumber.equal(newBondSize);
            expect(bountySize).to.be.bignumber.equal(newBountySize);
        });

        it('should update the actual bond value after the waiting period', async () => {
            const newBondSize = new BN(this.initialBondSize).muln(2);
            const newBountySize = new BN(this.initialExitBountySize).addn(1000);
            await this.contract.updateBondSize(newBondSize, newBountySize);

            // Wait half the waiting period
            await time.increase(HALF_WAITING_PERIOD);

            // Update again while the first update is in progress.
            const secondNewBondSize = new BN(this.initialBondSize).muln(1.5);
            const secondNewBountySize = secondNewBondSize.subn(1);
            await this.contract.updateBondSize(secondNewBondSize, secondNewBountySize);

            // Wait half the waiting period again.
            await time.increase(HALF_WAITING_PERIOD);
            // Even though the first update's waiting period is over, the second
            // update is in progress so the bond size should not have changed yet.
            let bondSize = await this.contract.bondSize();
            let bountySize = await this.contract.bountySize();
            expect(bondSize).to.be.bignumber.equal(this.initialBondSize);
            expect(bountySize).to.be.bignumber.equal(this.initialExitBountySize);

            // Wait the remaining waiting period
            await time.increase(HALF_WAITING_PERIOD);
            bondSize = await this.contract.bondSize();
            bountySize = await this.contract.bountySize();
            expect(bondSize).to.be.bignumber.equal(secondNewBondSize);
            expect(bountySize).to.be.bignumber.equal(secondNewBountySize);
        });

        it('should be able to update continuosly', async () => {
            const newBondSize1 = new BN(this.initialBondSize).muln(2);
            const newBountySize1 = newBondSize1.subn(1000);
            await this.contract.updateBondSize(newBondSize1, newBountySize1);
            await time.increase(WAITING_PERIOD);

            let bondSize = await this.contract.bondSize();
            let bountySize = await this.contract.bountySize();
            expect(bondSize).to.be.bignumber.equal(newBondSize1);
            expect(bountySize).to.be.bignumber.equal(newBountySize1);

            const newBondSize2 = newBondSize1.muln(2);
            const newBountySize2 = newBondSize1.muln(2);
            await this.contract.updateBondSize(newBondSize2, newBountySize2);

            // Before a full waiting period is finished, it would still not update to latest
            await time.increase(HALF_WAITING_PERIOD);
            bondSize = await this.contract.bondSize();
            bountySize = await this.contract.bountySize();
            expect(bondSize, 'should not update to latest yet').to.be.bignumber.equal(newBondSize1);
            expect(bountySize, 'should not update to latest yet').to.be.bignumber.equal(newBountySize1);

            // update to latest after full waiting period is done
            await time.increase(HALF_WAITING_PERIOD);
            bondSize = await this.contract.bondSize();
            bountySize = await this.contract.bountySize();
            expect(bondSize, 'should update to latest').to.be.bignumber.equal(newBondSize2);
            expect(bountySize, 'should update to latest').to.be.bignumber.equal(newBountySize2);
        });
    });

    describe('with boundary size of numbers', () => {
        it('should able to update to max number of uint128 without having overflow issue', async () => {
            const maxSizeOfUint128 = (new BN(2)).pow(new BN(128)).sub(new BN(1)); // 2^128 - 1

            const initialBondSize = maxSizeOfUint128.sub(new BN(10000));
            const initialBountySize = initialBondSize.subn(1);
            const lowerBoundDivisor = 2;
            const upperBoundMultiplier = 3;
            const contract = await BondSizeMock.new(
                initialBondSize,
                initialBountySize,
                lowerBoundDivisor,
                upperBoundMultiplier,
            );

            await contract.updateBondSize(maxSizeOfUint128, initialBountySize);
            await time.increase(WAITING_PERIOD);
            const bondSize = await contract.bondSize();
            expect(bondSize).to.be.bignumber.equal(maxSizeOfUint128);
        });

        it('should be able to update to 1', async () => {
            const initialBondSize = new BN(2);
            const initialBountySize = new BN(1);
            const lowerBoundDivisor = 2;
            const upperBoundMultiplier = 3;
            const contract = await BondSizeMock.new(
                initialBondSize,
                initialBountySize,
                lowerBoundDivisor,
                upperBoundMultiplier,
            );
            const bondSizeOne = new BN(1);

            await contract.updateBondSize(bondSizeOne, initialBountySize);
            await time.increase(WAITING_PERIOD);
            const bondSize = await contract.bondSize();
            expect(bondSize).to.be.bignumber.equal(bondSizeOne);
        });

        it('should NOT be able to update to 0', async () => {
            const initialBondSize = new BN(2);
            const initialBountySize = new BN(0);
            const lowerBoundDivisor = 2;
            const upperBoundMultiplier = 3;
            const contract = await BondSizeMock.new(
                initialBondSize,
                initialBountySize,
                lowerBoundDivisor,
                upperBoundMultiplier,
            );
            const bondSizeZero = new BN(0);

            await expectRevert(
                contract.updateBondSize(bondSizeZero, initialBountySize),
                'Bond size cannot be zero',
            );
        });
    });
});
