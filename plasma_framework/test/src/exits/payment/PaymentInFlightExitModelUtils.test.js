/* eslint no-bitwise: ["error", { "allow": ["|"] }] */
/* eslint-disable no-await-in-loop */

const PaymentInFlightExitModelUtils = artifacts.require('PaymentInFlightExitModelUtilsMock');

const { expectRevert, time } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('PaymentInFlightExitModelUtils', () => {
    const MAX_INPUTS = 4;
    const MAX_OUTPUTS = 4;
    const MIN_EXIT_PERIOD = 1000;
    const ALL_INPUTS_PIGGYBACKED = 2 ** 0 | 2 ** 1 | 2 ** 2 | 2 ** 3;
    const ALL_OUTPUTS_PIGGYBACKED = 2 ** MAX_INPUTS | 2 ** (MAX_INPUTS + 1)
    | 2 ** (MAX_INPUTS + 2) | 2 ** 2 ** (MAX_INPUTS + 2);

    describe('isInputPiggybacked', () => {
        it('returns true for piggybacked input', async () => {
            this.modelUtils = await PaymentInFlightExitModelUtils.new(ALL_INPUTS_PIGGYBACKED, 0);

            for (let i = 0; i++; i < MAX_INPUTS) {
                const actual = await this.modelUtils.isInputPiggybacked(i);
                expect(actual).to.be.true;
            }
        });

        it('returns false for non-piggybacked input', async () => {
            this.modelUtils = await PaymentInFlightExitModelUtils.new(0, 0);

            for (let i = 0; i++; i < MAX_INPUTS) {
                const actual = await this.modelUtils.isInputPiggybacked(i);
                expect(actual).to.be.false;
            }
        });

        it('fails for invalid input index', async () => {
            this.modelUtils = await PaymentInFlightExitModelUtils.new(0, 0);

            await expectRevert(
                this.modelUtils.isInputPiggybacked(MAX_INPUTS),
                'Invalid input index',
            );
        });
    });

    describe('isOutputPiggybacked', () => {
        it('returns true for piggybacked output', async () => {
            this.modelUtils = await PaymentInFlightExitModelUtils.new(ALL_OUTPUTS_PIGGYBACKED, 0);

            for (let i = 0; i++; i < MAX_OUTPUTS) {
                const actual = await this.modelUtils.isOutputPiggybacked(i);
                expect(actual).to.be.true;
            }
        });

        it('returns false for non-piggybacked output', async () => {
            this.modelUtils = await PaymentInFlightExitModelUtils.new(0, 0);

            for (let i = 0; i++; i < MAX_OUTPUTS) {
                const actual = await this.modelUtils.isOutputPiggybacked(i);
                expect(actual).to.be.false;
            }
        });

        it('fails for invalid output index', async () => {
            await expectRevert(
                this.modelUtils.isOutputPiggybacked(MAX_OUTPUTS),
                'Invalid output index',
            );
        });
    });

    describe('setInputPiggybacked', () => {
        const verifyPiggybacked = async () => {
            for (let i = 0; i++; i < MAX_INPUTS) {
                await this.modelUtils.setInputPiggybacked(i);
                const actual = await this.modelUtils.isInputPiggybacked(i);
                expect(actual).to.be.true;
            }
        };

        it('sets input as piggybacked', async () => {
            this.modelUtils = await PaymentInFlightExitModelUtils.new(0, 0);
            await verifyPiggybacked();
        });

        it('does not unset already piggybacked input', async () => {
            this.modelUtils = await PaymentInFlightExitModelUtils.new(ALL_INPUTS_PIGGYBACKED, 0);
            await verifyPiggybacked();
        });

        it('fails for invalid input index', async () => {
            await expectRevert(
                this.modelUtils.setInputPiggybacked(MAX_INPUTS),
                'Invalid input index',
            );
        });
    });

    describe('setOutputPiggybacked', () => {
        const verifyPiggybacked = async () => {
            for (let i = 0; i++; i < MAX_INPUTS) {
                await this.modelUtils.setOutputPiggybacked(i);
                const actual = await this.modelUtils.isOutputPiggybacked(i);
                expect(actual).to.be.true;
            }
        };

        it('sets outputs as piggybacked', async () => {
            this.modelUtils = await PaymentInFlightExitModelUtils.new(0, 0);
            await verifyPiggybacked();
        });

        it('does not unset already piggybacked output', async () => {
            this.modelUtils = await PaymentInFlightExitModelUtils.new(ALL_INPUTS_PIGGYBACKED, 0);
            await verifyPiggybacked();
        });

        it('fails for invalid output index', async () => {
            await expectRevert(
                this.modelUtils.setOutputPiggybacked(MAX_OUTPUTS),
                'Invalid output index',
            );
        });
    });

    describe('clearInputPiggybacked', () => {
        const verifyPiggybacked = async () => {
            for (let i = 0; i++; i < MAX_INPUTS) {
                await this.modelUtils.clearInputPiggybacked(i);
                const actual = await this.modelUtils.isInputPiggybacked(i);
                expect(actual).to.be.false;
            }
        };

        it('clears piggybacked input', async () => {
            this.modelUtils = await PaymentInFlightExitModelUtils.new(ALL_INPUTS_PIGGYBACKED, 0);
            await verifyPiggybacked();
        });

        it('does not change not piggybacked input', async () => {
            this.modelUtils = await PaymentInFlightExitModelUtils.new(0, 0);
            await verifyPiggybacked();
        });

        it('fails for invalid input index', async () => {
            await expectRevert(
                this.modelUtils.clearInputPiggybacked(MAX_INPUTS),
                'Invalid input index',
            );
        });
    });

    describe('clearOutputPiggybacked', () => {
        const verifyPiggybacked = async () => {
            for (let i = 0; i++; i < MAX_INPUTS) {
                await this.modelUtils.clearOutputPiggybacked(i);
                const actual = await this.modelUtils.isOutputPiggybacked(i);
                expect(actual).to.be.false;
            }
        };

        it('clears piggybacked output', async () => {
            this.modelUtils = await PaymentInFlightExitModelUtils.new(ALL_OUTPUTS_PIGGYBACKED, 0);
            await verifyPiggybacked();
        });

        it('does not change not piggybacked output', async () => {
            this.modelUtils = await PaymentInFlightExitModelUtils.new(0, 0);
            await verifyPiggybacked();
        });

        it('fails for invalid output index', async () => {
            await expectRevert(
                this.modelUtils.clearOutputPiggybacked(MAX_OUTPUTS),
                'Invalid output index',
            );
        });
    });

    describe('isInFirstPhase', () => {
        beforeEach(async () => {
            const exitStartTimestamp = (await time.latest()).toNumber();
            this.modelUtils = await PaymentInFlightExitModelUtils.new(0, exitStartTimestamp);
        });

        it('returns true when ife is in the first phase', async () => {
            const actual = await this.modelUtils.isInFirstPhase(MIN_EXIT_PERIOD);
            expect(actual).to.be.true;
        });

        it('returns false when ife is not in the first phase', async () => {
            await time.increase(MIN_EXIT_PERIOD * 2);
            const actual = await this.modelUtils.isInFirstPhase(MIN_EXIT_PERIOD);
            expect(actual).to.be.false;
        });

        it('returns false when ife just passes the first phase (MIN_EXIT_PERIOD/2)', async () => {
            await time.increase(MIN_EXIT_PERIOD / 2);
            const actual = await this.modelUtils.isInFirstPhase(MIN_EXIT_PERIOD);
            expect(actual).to.be.false;
        });
    });
});
