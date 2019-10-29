const PriorityQueue = artifacts.require('PriorityQueue');

const { BN, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('PriorityQueue', ([_, nonOwner]) => {
    beforeEach(async () => {
        this.priorityQueue = await PriorityQueue.new();
    });

    describe('getMin', () => {
        it('can get the min value', async () => {
            const testValue = 2;
            await this.priorityQueue.insert(testValue);
            expect(await this.priorityQueue.getMin())
                .to.be.bignumber.equal(new BN(testValue));
        });

        it('fails when empty', async () => {
            const errorMsg = 'Returned error: VM Exception while processing transaction: invalid opcode';
            await this.priorityQueue.getMin()
                .catch(err => expect(err.message).to.equal(errorMsg));
        });
    });

    describe('currentSize', () => {
        it('can get current size', async () => {
            await this.priorityQueue.insert(2);
            expect(await this.priorityQueue.currentSize())
                .to.be.bignumber.equal(new BN(1));
        });
    });

    describe('insert', () => {
        it('can insert one value', async () => {
            const testValue = 2;
            await this.priorityQueue.insert(testValue);
            expect(await this.priorityQueue.getMin())
                .to.be.bignumber.equal(new BN(testValue));
            expect(await this.priorityQueue.currentSize())
                .to.be.bignumber.equal(new BN(1));
        });

        it('can insert two values with order', async () => {
            const smallerValue = 2;
            const largerValue = 5;
            await this.priorityQueue.insert(smallerValue);
            await this.priorityQueue.insert(largerValue);
            expect(await this.priorityQueue.getMin())
                .to.be.bignumber.equal(new BN(smallerValue));
            expect(await this.priorityQueue.currentSize())
                .to.be.bignumber.equal(new BN(2));
        });

        it('can insert multiple values out of order and still get the minimal number', async () => {
            const valuesOutOfOrder = [13, 11, 17, 5, 3, 1, 2];

            await Promise.all(valuesOutOfOrder.map(async value => this.priorityQueue.insert(value)));

            expect(await this.priorityQueue.getMin())
                .to.be.bignumber.equal(new BN(Math.min(...valuesOutOfOrder)));
            expect(await this.priorityQueue.currentSize())
                .to.be.bignumber.equal(new BN(valuesOutOfOrder.length));
        });

        it('is not idempotent', async () => {
            const testValue = 2;
            await this.priorityQueue.insert(testValue);
            await this.priorityQueue.insert(testValue);

            expect(await this.priorityQueue.getMin())
                .to.be.bignumber.equal(new BN(testValue));
            expect(await this.priorityQueue.currentSize())
                .to.be.bignumber.equal(new BN(2));
        });

        it('should fail when not inserted by the framework (who deploys the priority queue contract)', async () => {
            await expectRevert(
                this.priorityQueue.insert(100, { from: nonOwner }),
                'Caller address is unauthorized',
            );
        });
    });

    describe('delMin', () => {
        it('can delete when single value in queue', async () => {
            await this.priorityQueue.insert(2);

            await this.priorityQueue.delMin();
            expect(await this.priorityQueue.currentSize())
                .to.be.bignumber.equal(new BN(0));
        });

        it('can delete when two values in queue', async () => {
            await this.priorityQueue.insert(2);
            await this.priorityQueue.insert(5);

            await this.priorityQueue.delMin();
            expect(await this.priorityQueue.getMin())
                .to.be.bignumber.equal(new BN(5));
            expect(await this.priorityQueue.currentSize())
                .to.be.bignumber.equal(new BN(1));
        });

        it('can delete when multiple values in queue', async () => {
            const valuesInOrder = [2, 3, 5, 7, 11, 13, 17];
            await Promise.all(valuesInOrder.map(async value => this.priorityQueue.insert(value)));

            await this.priorityQueue.delMin();
            expect(await this.priorityQueue.getMin())
                .to.be.bignumber.equal(new BN(valuesInOrder[1]));
            expect(await this.priorityQueue.currentSize())
                .to.be.bignumber.equal(new BN(valuesInOrder.length - 1));
        });

        it('can delete all', async () => {
            const values = [2, 3, 5, 7, 11, 13, 17];
            await Promise.all(values.map(async value => this.priorityQueue.insert(value)));

            await Promise.all(values.map(async () => this.priorityQueue.delMin()));
            expect(await this.priorityQueue.currentSize())
                .to.be.bignumber.equal(new BN(0));
        });

        it('should fail when not deleted by the framework (who deploys the priority queue contract)', async () => {
            await expectRevert(
                this.priorityQueue.delMin({ from: nonOwner }),
                'Caller address is unauthorized',
            );
        });
    });
});
