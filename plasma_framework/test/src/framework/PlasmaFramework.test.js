const PlasmaFramework = artifacts.require('PlasmaFramework');

const { BN } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('PlasmaFramework', ([operator]) => {
    const INITIAL_IMMUNE_VAULTS = 1;
    const INITIAL_IMMUNE_EXIT_GAMES = 1;
    describe('constructor', () => {
        it('should set the min exit period', async () => {
            const testMinExitPeriod = 1000;
            const framework = await PlasmaFramework.new(
                operator, testMinExitPeriod, INITIAL_IMMUNE_VAULTS, INITIAL_IMMUNE_EXIT_GAMES,
            );
            expect(await framework.minExitPeriod()).to.be.bignumber.equal(new BN(testMinExitPeriod));
        });
    });
});
