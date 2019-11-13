const PriorityQueue = artifacts.require('PriorityQueue');
const LoadTest = artifacts.require('PriorityQueueLoadTest');

const { expect } = require('chai');
const seedrandom = require('seedrandom');

contract.skip('PriorityQueue Load Test', ([framework]) => {
    // The total number of elements to inject to queue
    const TEST_SIZE = 1000000;
    const BATCH_SIZE = 10000;
    const MAX_GAS_EXPECTING = 1000000;

    beforeEach(async () => {
        this.priorityQueue = await PriorityQueue.new();
    });

    describe('load test on gas limit', () => {
        beforeEach(async () => {
            this.loadTest = await LoadTest.new();
            this.determisticRandom = seedrandom('static seed');
        });

        /**
         * This test is designed to inject and deleted every BATCH_SIZE.
         * The test itself requires some gas more than usually Ethereum block gas limit,
         * also quite a lot much more initial Eth fund on the test accounts.
         *
         * During this test, it injects sorted value to heap as sorted array would fullfil the requirement for heap.
         * For each batch, it inserts 0 and delMin (which would always be 0 as 0 is the min value of uint).
         * Reason of using 0 is to make sure it would be testing worse case + it would be removed right after.
         */
        it('should test and print the gas cost for each batch size items', async () => {
            const values = [...Array(TEST_SIZE)].map(() => {
                const num = this.determisticRandom.int32();
                return num > 0 ? num : -1 * num;
            });
            values.sort();

            for (let i = 0; i < TEST_SIZE / BATCH_SIZE; i++) {
                const start = i * BATCH_SIZE;
                const end = (i + 1) * BATCH_SIZE;
                const heapDataToSet = values.slice(start, end);

                /* eslint-disable no-await-in-loop */
                await this.loadTest.setHeapData(heapDataToSet);

                const txInsert = await this.loadTest.insert(0);
                const txDelMin = await this.loadTest.delMin();

                console.log('# batch num:', i, '| gas used for insert:', txInsert.receipt.gasUsed, '| gas used for delMin:', txDelMin.receipt.gasUsed, '| remaining balance: ', await web3.eth.getBalance(framework));

                expect(txInsert.receipt.gasUsed).to.be.at.most(MAX_GAS_EXPECTING);
                expect(txDelMin.receipt.gasUsed).to.be.at.most(MAX_GAS_EXPECTING);
            }
        }).timeout(12 * 60 * 60 * 1000); // 12 hours
    });
});
