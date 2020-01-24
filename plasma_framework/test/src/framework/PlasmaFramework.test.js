const PlasmaFramework = artifacts.require('PlasmaFramework');

const { BN } = require('openzeppelin-test-helpers');
const { expect } = require('chai');
const { expectRevert } = require('openzeppelin-test-helpers');
const childProcess = require('child_process');

contract('PlasmaFramework', ([authority, maintainer, alice]) => {
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

        it('should set maintainer address', async () => {
            expect(await this.framework.getMaintainer()).to.equal(maintainer);
        });

        it('should set semver string', async () => {
            const sha = childProcess.execSync('git rev-parse HEAD').toString().trim()
                .substring(0, 7);
            await this.framework.setVersion(''.concat('1.0.1', '+', sha), { from: maintainer });
            expect(await this.framework.getVersion()).to.equal('1.0.1'.concat('+', sha));
        });

        it('should fail when semver not set by maintainer', async () => {
            await expectRevert(
                this.framework.setVersion('yolo', { from: alice }),
                'Caller address is unauthorized',
            );
        });
    });
});
