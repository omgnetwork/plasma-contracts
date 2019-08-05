const ExitPriority = artifacts.require('ExitPriorityWrapper');

const { BN } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { buildTxPos } = require('../../../helpers/positions.js');

contract('ExitPriority', () => {
    beforeEach(async () => {
        this.contract = await ExitPriority.new();
    });

    const expectPriorityPossitivelyCorrelative = async (exitableAt1, exitableAt2, txPos1, txPos2, nonce1, nonce2) => {
        const priority1 = await this.contract.computePriority(exitableAt1, txPos1, nonce1);
        const priority2 = await this.contract.computePriority(exitableAt2, txPos2, nonce2);
        expect(priority1).to.be.a.bignumber.that.is.lessThan(priority2);
    };

    describe('computePriority', () => {
        describe('Given different exitableAt', () => {
            before(() => {
                const smallerNonce = 1;
                const largerNonce = 2;
                this.nonces = [smallerNonce, largerNonce];

                const smallerTxPos = buildTxPos(1000, 0);
                const largerTxPos = buildTxPos(2000, 0);
                this.txPoses = [smallerTxPos, largerTxPos];
            });

            it('should be positive correlative with "exitable" no matter txPos and nonce combination', async () => {
                const exitableAt1 = 1;
                const exitableAt2 = 2;

                this.txPoses.forEach(async (txPos1) => {
                    this.txPoses.forEach(async (txPos2) => {
                        this.nonces.forEach(async (nonce1) => {
                            this.nonces.forEach(async (nonce2) => {
                                await expectPriorityPossitivelyCorrelative(
                                    exitableAt1, exitableAt2,
                                    txPos1, txPos2,
                                    nonce1, nonce2,
                                );
                            });
                        });
                    });
                });
            });
        });

        describe('Given exitableAt is the same', () => {
            before(() => {
                this.exitableAt = 1;

                const smallerNonce = 1;
                const largerNonce = 2;
                this.nonces = [smallerNonce, largerNonce];
            });

            it('should be positive correlative with "txPos" no matter how nonces are', async () => {
                const txPos1 = buildTxPos(1000, 0);
                const txPos2 = buildTxPos(2000, 0);
                this.nonces.forEach(async (nonce1) => {
                    this.nonces.forEach(async (nonce2) => {
                        await expectPriorityPossitivelyCorrelative(
                            this.exitableAt, this.exitableAt,
                            txPos1, txPos2,
                            nonce1, nonce2,
                        );
                    });
                });
            });
        });

        describe('Given both exitableAt and txPos are the same', () => {
            before(() => {
                this.smallerNonce = 1;
                this.largerNonce = 2;
                this.exitableAt = 1;
                this.txPos = buildTxPos(1000, 0);
            });

            it('should be positively correlative with "nonce"', async () => {
                const priority1 = await this.contract.computePriority(
                    this.exitableAt, this.txPos, this.smallerNonce,
                );
                const priority2 = await this.contract.computePriority(
                    this.exitableAt, this.txPos, this.largerNonce,
                );
                expect(priority1).to.be.a.bignumber.that.is.lessThan(priority2);
            });
        });
    });

    describe('parseExitableAt', () => {
        it('should be able to parse the "exitableAt" from priority given nonce is 0', async () => {
            const exitableAt = 123;
            const nonce = 0;
            const txPos = buildTxPos(1000, 0);
            const priority = await this.contract.computePriority(exitableAt, txPos, nonce);
            const parsedExitableAt = await this.contract.parseExitableAt(priority);
            expect(parsedExitableAt).to.be.bignumber.equal(new BN(exitableAt));
        });

        it('should be able to parse the "exitableAt" from priority given max nonce value', async () => {
            const exitableAt = 123;
            const nonce = (new BN(2)).pow(new BN(64)).sub(new BN(1)); // 2^64 - 1
            const txPos = buildTxPos(1000, 0);
            const priority = await this.contract.computePriority(exitableAt, txPos, nonce);
            const parsedExitableAt = await this.contract.parseExitableAt(priority);
            expect(parsedExitableAt).to.be.bignumber.equal(new BN(exitableAt));
        });

        it('should be able to parse the "exitableAt" from priority given exitable timestamp is 0', async () => {
            const exitableAt = 0;
            const nonce = 123;
            const txPos = buildTxPos(1000, 0);
            const priority = await this.contract.computePriority(exitableAt, txPos, nonce);
            const parsedExitableAt = await this.contract.parseExitableAt(priority);
            expect(parsedExitableAt).to.be.bignumber.equal(new BN(exitableAt));
        });

        it('should be able to parse the "exitableAt" from priority given max exitable timestamp of uint64', async () => {
            const exitableAt = (new BN(2)).pow(new BN(64)).sub(new BN(1)); // 2^64 - 1
            const nonce = 123;
            const txPos = buildTxPos(1000, 0);
            const priority = await this.contract.computePriority(exitableAt, txPos, nonce);
            const parsedExitableAt = await this.contract.parseExitableAt(priority);
            expect(parsedExitableAt).to.be.bignumber.equal(exitableAt);
        });

        it('should be able to parse the "exitableAt" from priority given txPos is 0', async () => {
            const exitableAt = 123;
            const nonce = 456;
            const txPos = 0;
            const priority = await this.contract.computePriority(exitableAt, txPos, nonce);
            const parsedExitableAt = await this.contract.parseExitableAt(priority);
            expect(parsedExitableAt).to.be.bignumber.equal(new BN(exitableAt));
        });

        it('should be able to parse the "exitableAt" from priority given max txPos of uint128', async () => {
            const exitableAt = 123;
            const nonce = 456;
            const txPos = (new BN(2)).pow(new BN(128)).sub(new BN(1)); // 2^128 - 1;
            const priority = await this.contract.computePriority(exitableAt, txPos, nonce);
            const parsedExitableAt = await this.contract.parseExitableAt(priority);
            expect(parsedExitableAt).to.be.bignumber.equal(new BN(exitableAt));
        });
    });
});
