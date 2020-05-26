const ExitPriority = artifacts.require('ExitPriorityWrapper');

const { BN } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { buildTxPos } = require('../../../helpers/positions.js');

const TX_OFFSET = 10000;

contract('ExitPriority', () => {
    beforeEach(async () => {
        this.contract = await ExitPriority.new();
    });

    const expectPriorityPossitivelyCorrelative = async (exitableAt1, exitableAt2, txPos1, txPos2, exitId1, exitId2) => {
        const priority1 = await this.contract.computePriority(exitableAt1, txPos1, exitId1);
        const priority2 = await this.contract.computePriority(exitableAt2, txPos2, exitId2);
        expect(priority1).to.be.a.bignumber.that.is.lessThan(priority2);
    };

    describe('computePriority', () => {
        describe('Given different exitableAt', () => {
            before(() => {
                this.exitIds = [1, 2];

                const smallerTxPos = buildTxPos(1000, 0);
                const largerTxPos = buildTxPos(200, 0);
                this.txPoses = [smallerTxPos, largerTxPos];
            });

            it('should be positive correlative with "exitable" no matter txPos and exit id combination', async () => {
                const exitableAt1 = 1;
                const exitableAt2 = 2;

                await Promise.all(this.txPoses.map(
                    async txPos1 => Promise.all(this.txPoses.map(
                        async txPos2 => Promise.all(this.exitIds.map(
                            async exitId1 => Promise.all(this.exitIds.map(
                                async exitId2 => expectPriorityPossitivelyCorrelative(
                                    exitableAt1, exitableAt2,
                                    txPos1, txPos2,
                                    exitId1, exitId2,
                                ),
                            )),
                        )),
                    )),
                ));
            });
        });

        describe('Given exitableAt is the same', () => {
            before(() => {
                this.exitableAt = 1;
                this.exitIds = [1, 2];
            });

            it('should be positive correlative with "txPos" no matter how exit ids are', async () => {
                const txPos1 = buildTxPos(1000, 0);
                const txPos2 = buildTxPos(2000, 0);

                await Promise.all(this.exitIds.map(
                    async exitId1 => Promise.all(this.exitIds.map(
                        async exitId2 => expectPriorityPossitivelyCorrelative(
                            this.exitableAt, this.exitableAt,
                            txPos1, txPos2,
                            exitId1, exitId2,
                        ),
                    )),
                ));
            });
        });

        describe('Given both exitableAt and txPos are the same', () => {
            before(() => {
                this.exitId1 = 1;
                this.exitId2 = 2;
                this.exitableAt = 1;
                this.txPos = buildTxPos(1000, 0);
            });

            it('should be positively correlative with exid id', async () => {
                const priority1 = await this.contract.computePriority(
                    this.exitableAt, this.txPos, this.exitId1,
                );
                const priority2 = await this.contract.computePriority(
                    this.exitableAt, this.txPos, this.exitId2,
                );
                expect(priority1).to.be.a.bignumber.that.is.lessThan(priority2);
            });
        });
    });

    describe('parseExitableAt', () => {
        it('should be able to parse the "exitableAt" from priority given exit id is 0', async () => {
            const exitableAt = 123;
            const exitId = 0;
            const txPos = buildTxPos(1000, 0);
            const priority = await this.contract.computePriority(exitableAt, txPos, exitId);
            const parsedExitableAt = await this.contract.parseExitableAt(priority);
            expect(parsedExitableAt).to.be.bignumber.equal(new BN(exitableAt));
            const parsedExitId = await this.contract.parseExitId(priority);
            expect(parsedExitId).to.be.bignumber.equal(new BN(exitId));
            const parsedTxPos = await this.contract.parseTxPos(priority);
            expect(parsedTxPos).to.be.bignumber.equal(new BN(txPos));
        });

        it('should be able to parse the "exitableAt" from priority given max exit id value', async () => {
            const exitableAt = 123;
            const exitId = (new BN(2)).pow(new BN(160)).sub(new BN(1)); // 2^160 - 1
            const txPos = buildTxPos(1000, 0);
            const priority = await this.contract.computePriority(exitableAt, txPos, exitId);
            const parsedExitableAt = await this.contract.parseExitableAt(priority);
            expect(parsedExitableAt).to.be.bignumber.equal(new BN(exitableAt));
            const parsedExitId = await this.contract.parseExitId(priority);
            expect(parsedExitId).to.be.bignumber.equal(new BN(exitId));
            const parsedTxPos = await this.contract.parseTxPos(priority);
            expect(parsedTxPos).to.be.bignumber.equal(new BN(txPos));
        });

        it('should be able to parse the "exitableAt" from priority given exitable timestamp is 0', async () => {
            const exitableAt = 0;
            const exitId = 123;
            const txPos = buildTxPos(1000, 0);
            const priority = await this.contract.computePriority(exitableAt, txPos, exitId);
            const parsedExitableAt = await this.contract.parseExitableAt(priority);
            expect(parsedExitableAt).to.be.bignumber.equal(new BN(exitableAt));
            const parsedExitId = await this.contract.parseExitId(priority);
            expect(parsedExitId).to.be.bignumber.equal(new BN(exitId));
            const parsedTxPos = await this.contract.parseTxPos(priority);
            expect(parsedTxPos).to.be.bignumber.equal(new BN(txPos));
        });

        it('should be able to parse the "exitableAt" from priority given max exitable timestamp of uint32', async () => {
            const exitableAt = (new BN(2)).pow(new BN(32)).sub(new BN(1)); // 2^32 - 1
            const exitId = 123;
            const txPos = buildTxPos(1000, 0);
            const priority = await this.contract.computePriority(exitableAt, txPos, exitId);
            const parsedExitableAt = await this.contract.parseExitableAt(priority);
            expect(parsedExitableAt).to.be.bignumber.equal(exitableAt);
            const parsedExitId = await this.contract.parseExitId(priority);
            expect(parsedExitId).to.be.bignumber.equal(new BN(exitId));
            const parsedTxPos = await this.contract.parseTxPos(priority);
            expect(parsedTxPos).to.be.bignumber.equal(new BN(txPos));
        });

        it('should be able to parse the "exitableAt" from priority given txPos is 0', async () => {
            const exitableAt = 123;
            const exitId = 456;
            const txPos = 0;
            const priority = await this.contract.computePriority(exitableAt, txPos, exitId);
            const parsedExitableAt = await this.contract.parseExitableAt(priority);
            expect(parsedExitableAt).to.be.bignumber.equal(new BN(exitableAt));
            const parsedExitId = await this.contract.parseExitId(priority);
            expect(parsedExitId).to.be.bignumber.equal(new BN(exitId));
            const parsedTxPos = await this.contract.parseTxPos(priority);
            expect(parsedTxPos).to.be.bignumber.equal(new BN(txPos));
        });

        it('should be able to parse the "exitableAt" from priority given max txPos of uint54', async () => {
            const exitId = (new BN(2)).pow(new BN(160)).sub(new BN(1)); // 2^160 - 1
            const exitableAt = 123;
            const txPos = (new BN(2)).pow(new BN(54)).sub(new BN(1)).divn(TX_OFFSET)
                .muln(TX_OFFSET); // max txPos of 2^54 - 1 (a multiple of TX_OFFSET)
            const priority = await this.contract.computePriority(exitableAt, txPos, exitId);
            const parsedExitableAt = await this.contract.parseExitableAt(priority);
            expect(parsedExitableAt).to.be.bignumber.equal(new BN(exitableAt));
            const parsedExitId = await this.contract.parseExitId(priority);
            expect(parsedExitId).to.be.bignumber.equal(new BN(exitId));
            const parsedTxPos = await this.contract.parseTxPos(priority);
            expect(parsedTxPos).to.be.bignumber.equal(new BN(txPos));
        });

        it('should be able to parse exit id from priority', async () => {
            const exitId = (new BN(2)).pow(new BN(160)).sub(new BN(1)); // 2^160 - 1
            const exitableAt = 123;
            // 2^52 - some random tx pos (must be a multiple of TX_OFFSET)
            const txPos = (new BN(2)).pow(new BN(52)).divn(TX_OFFSET).muln(TX_OFFSET);
            const priority = await this.contract.computePriority(exitableAt, txPos, exitId);
            const parsedExitId = await this.contract.parseExitId(priority);

            expect(parsedExitId).to.be.bignumber.equal(exitId);
            const parsedTxPos = await this.contract.parseTxPos(priority);
            expect(parsedTxPos).to.be.bignumber.equal(new BN(txPos));
        });
    });
});
