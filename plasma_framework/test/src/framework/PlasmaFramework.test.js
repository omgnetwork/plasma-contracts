const PlasmaFramework = artifacts.require('PlasmaFramework');

const { BN } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('PlasmaFramework', () => {
    const INITIAL_IMMUNE_VAULTS = 1;
    describe('constructor', () => {
        it('should set the min exit period', async () => {
            const testMinExitPeriod = 1000;
            const framework = await PlasmaFramework.new(testMinExitPeriod, INITIAL_IMMUNE_VAULTS);
            expect(await framework.minExitPeriod()).to.be.bignumber.equal(new BN(testMinExitPeriod));
        });
    });
});
