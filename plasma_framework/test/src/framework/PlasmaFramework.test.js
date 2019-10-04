const PlasmaFramework = artifacts.require('PlasmaFramework');

const { BN } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('PlasmaFramework', ([authority, maintainer]) => {
    const INITIAL_IMMUNE_VAULTS = 1;
    const INITIAL_IMMUNE_EXIT_GAMES = 1;
    const TEST_MIN_EXIT_PERIOD = 1000;

    describe('constructor', () => {
        beforeEach(async () => {
            this.framework = await PlasmaFramework.new(
                TEST_MIN_EXIT_PERIOD,
                INITIAL_IMMUNE_VAULTS,
                INITIAL_IMMUNE_EXIT_GAMES,
                authority,
                maintainer,
            );
        });

        it('should set the min exit period', async () => {
            expect(await this.framework.minExitPeriod())
                .to.be.bignumber.equal(new BN(TEST_MIN_EXIT_PERIOD));
        });

        it('should set authority address', async () => {
            expect(await this.framework.authority()).to.equal(authority);
        });

        it('should set maintainer address', async () => {
            expect(await this.framework.maintainer()).to.equal(maintainer);
        });
    });
});
