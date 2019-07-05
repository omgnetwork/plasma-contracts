const ExitableTimestamp = artifacts.require('ExitableTimestampWrapper');

const { BN, time } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('ExitableTimestamp', () => {
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week

    before('setup', async () => {
        this.contract = await ExitableTimestamp.new(MIN_EXIT_PERIOD);
    });

    describe('calculate', () => {
        it('should get the correct exit timestamp for deposit tx', async () => {
            const latestTimestamp = await time.latest();
            expect(await this.contract.calculate(latestTimestamp, MIN_EXIT_PERIOD, true))
                .to.be.bignumber.equal(latestTimestamp.add(new BN(MIN_EXIT_PERIOD)));
        });

        it('should get the correct exit timestamp for non deposit tx whose age is older than MIN_EXIT_PERIOD', async () => {
            const latestTimestamp = await time.latest();
            const oldTimestamp = 0;
            expect(await this.contract.calculate(latestTimestamp, oldTimestamp, false))
                .to.be.bignumber.equal(latestTimestamp.add(new BN(MIN_EXIT_PERIOD)));
        });

        it('should get the correct exit timestamp for non deposit tx whose age is younger than MIN_EXIT_PERIOD', async () => {
            const latestTimestamp = await time.latest();
            const youngTimestamp = latestTimestamp - 15;
            expect(await this.contract.calculate(latestTimestamp, youngTimestamp, false))
                .to.be.bignumber.equal(new BN(youngTimestamp + 2 * MIN_EXIT_PERIOD));
        });
    });
});
