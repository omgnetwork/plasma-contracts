const PlasmaFramework = artifacts.require('PlasmaFramework');

const { BN } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('PlasmaFramework', () => {
    describe('constructor', () => {
        it('should set the min exit period', async () => {
            const testMinExitPeriod = 1000;
            const framework = await PlasmaFramework.new(testMinExitPeriod);
            expect(await framework.minExitPeriod()).to.be.bignumber.equal(new BN(testMinExitPeriod));
        });
    });
});
