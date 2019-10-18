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

        it('can insert multiple values with order', async () => {
            const smallerValue = 2;
            const largerValue = 5;
            await this.priorityQueue.insert(smallerValue);
            await this.priorityQueue.insert(largerValue);
            expect(await this.priorityQueue.getMin())
                .to.be.bignumber.equal(new BN(smallerValue));
            expect(await this.priorityQueue.currentSize())
                .to.be.bignumber.equal(new BN(2));
        });

        it('can insert out of order and still get the minimal number', async () => {
            const smallerValue = 2;
            const largerValue = 5;
            await this.priorityQueue.insert(largerValue);
            await this.priorityQueue.insert(smallerValue);
            expect(await this.priorityQueue.getMin())
                .to.be.bignumber.equal(new BN(smallerValue));
            expect(await this.priorityQueue.currentSize())
                .to.be.bignumber.equal(new BN(2));
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

        it('should fail when not inserted by the owner', async () => {
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

        it('can delete when multiple values in queue', async () => {
            await this.priorityQueue.insert(2);
            await this.priorityQueue.insert(5);

            await this.priorityQueue.delMin();
            expect(await this.priorityQueue.getMin())
                .to.be.bignumber.equal(new BN(5));
            expect(await this.priorityQueue.currentSize())
                .to.be.bignumber.equal(new BN(1));
        });

        it('can delete all', async () => {
            await this.priorityQueue.insert(2);
            await this.priorityQueue.insert(5);

            await this.priorityQueue.delMin();
            await this.priorityQueue.delMin();

            expect(await this.priorityQueue.currentSize())
                .to.be.bignumber.equal(new BN(0));
        });

        it('should fail when not deleted by the owner', async () => {
            await expectRevert(
                this.priorityQueue.delMin({ from: nonOwner }),
                'Caller address is unauthorized',
            );
        });
    });
});
