const PlasmaFramework = artifacts.require('PlasmaFramework');
const PriorityQueueLib = artifacts.require('PriorityQueueLib');

const { BN } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('PlasmaFramework', () => {
    before('link library', async () => {
        const priorityQueueLib = await PriorityQueueLib.new();
        await PlasmaFramework.link("PriorityQueueLib", priorityQueueLib.address);
    });

    describe('constructor', () => {
        it('should set the min exit period', async () => {
            const testMinExitPeriod = 1000;
            const framework = await PlasmaFramework.new(testMinExitPeriod);
            expect(await framework.minExitPeriod()).to.be.bignumber.equal(new BN(testMinExitPeriod));
        });
    });
});
