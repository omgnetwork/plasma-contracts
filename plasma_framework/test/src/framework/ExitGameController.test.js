const PriorityQueue = artifacts.require('PriorityQueue');
const PriorityQueueLib = artifacts.require('PriorityQueueLib');
const ExitGameController = artifacts.require('ExitGameController');
const DummyExitGame = artifacts.require('DummyExitGame');

const { BN, constants, expectEvent, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('ExitGameController', () => {
    before(async () => {
        const priorityQueueLib = await PriorityQueueLib.new();
        await ExitGameController.link("PriorityQueueLib", priorityQueueLib.address);
    });

    beforeEach(async () => {
        this.controller = await ExitGameController.new();
        this.dummyExitGame = await DummyExitGame.new();
        this.dummyExitGame.setExitGameController(this.controller.address);

        this.dummyTxType = 1;
        this.controller.registerExitGame(this.dummyTxType, this.dummyExitGame.address);

        this.dummyToken = constants.ZERO_ADDRESS;
    });

    describe('exitQueueNonce', () => {
        it('can receive the exit queue nonce', async () => {
            expect(await this.controller.exitQueueNonce()).to.be.bignumber.equal(new BN(1));
        });
    });

    describe('exits', () => {
        it('can receive exit data with the unique priority', async () => {
            const exit = await this.controller.exits(0);
            expect(exit.exitProcessor).to.equal(constants.ZERO_ADDRESS);
            expect(exit.exitableAt).to.be.bignumber.equal(new BN(0));
            expect(exit.exitId).to.be.bignumber.equal(new BN(0));
        });
    });

    describe('exitsQueues', () => {
        it('can review the priority queue contract for the token', async () => {
            expect(await this.controller.exitsQueues(this.dummyToken)).to.equal(constants.ZERO_ADDRESS);
        });
    });

    describe('hasToken', () => {
        it('returns true when token already added', async () => {
            await this.controller.addToken(this.dummyToken);
            expect(await this.controller.hasToken(this.dummyToken)).to.be.true;
        });

        it('returns false when token not added', async () => {
            expect(await this.controller.hasToken(this.dummyToken)).to.not.be.true;
        });
    });

    describe('addToken', () => {
        it('rejects when token already added', async () => {
            await this.controller.addToken(this.dummyToken);
            await expectRevert(
                this.controller.addToken(this.dummyToken),
                "Such token has already been added"
            );
        });

        it('generates a priority queue instance to the exitsQueues map', async () => {
            await this.controller.addToken(this.dummyToken);

            const priorityQueue = await this.controller.exitsQueues(this.dummyToken);
            expect(priorityQueue).to.not.equal(constants.ZERO_ADDRESS);
        });

        it('emits TokenAdded event', async () => {
            const tx = await this.controller.addToken(this.dummyToken);
            await expectEvent.inLogs(tx.logs, 'TokenAdded', { token: this.dummyToken });
        });
    });

    describe('enqueue', () => {
        beforeEach(async() => {
            this.dummyExit = {
                exitProcessor: this.dummyExitGame.address,
                exitableAt: 1,
                exitId: 123,
            };
            this.controller.addToken(this.dummyToken);
        });

        it('rejects when not called from exit game contract', async () => {
            await expectRevert(
                this.controller.enqueue(0, constants.ZERO_ADDRESS, this.dummyExit),
                "Not being called by registered exit game contract"
            );
        });

        it('rejects when such token has not been added yet', async () => {
            const fakeNonAddedTokenAddress = (await DummyExitGame.new()).address;
            await expectRevert(
                this.dummyExitGame.enqueue(0, fakeNonAddedTokenAddress, this.dummyExit),
                "Such token has not been added to the plasma framework yet"
            );
        });

        it('increases `exitQueueNonce` once', async () => {
            const originExitQueueNonce = await this.controller.exitQueueNonce();

            await this.dummyExitGame.enqueue(0, this.dummyToken, this.dummyExit);

            expect(await this.controller.exitQueueNonce())
                .to.be.bignumber.equal(originExitQueueNonce.add(new BN(1)));
        });

        it('inserts the new unique priority to the queue', async () => {
            await this.dummyExitGame.enqueue(0, this.dummyToken, this.dummyExit);
            
            const priorityQueueAddress = await this.controller.exitsQueues(this.dummyToken);
            const priorityQueue = await PriorityQueue.at(priorityQueueAddress);
            const queueMin = await priorityQueue.getMin();

            const uniquePriority = await this.dummyExitGame.uniquePriorityFromEnqueue();

            expect(queueMin).to.be.bignumber.equal(uniquePriority);
        });

        it('saves the exit data to map', async () => {
            await this.dummyExitGame.enqueue(0, this.dummyToken, this.dummyExit);
            
            const uniquePriority = await this.dummyExitGame.uniquePriorityFromEnqueue();
            const exit = await this.controller.exits(uniquePriority);

            expect(exit.exitProcessor).to.equal(this.dummyExit.exitProcessor);
            expect(exit.exitableAt).to.be.bignumber.equal(new BN(this.dummyExit.exitableAt));
            expect(exit.exitId).to.be.bignumber.equal(new BN(this.dummyExit.exitId));
        });

        it('can enqueue with the same exit priority multiple times', async ()=> {
            const exitPriority = 1;
            const dummyExit2 = {
                exitProcessor: this.dummyExitGame.address,
                exitableAt: 1,
                exitId: 456,
            }
            await this.dummyExitGame.enqueue(exitPriority, this.dummyToken, this.dummyExit);
            await this.dummyExitGame.enqueue(exitPriority, this.dummyToken, dummyExit2);

            const priorityQueueAddress = await this.controller.exitsQueues(this.dummyToken);
            const priorityQueue = await PriorityQueue.at(priorityQueueAddress);
            expect(await priorityQueue.currentSize()).to.be.bignumber.equal(new BN(2));
        });
    });

    describe('processExits', () => {
        beforeEach(async () => {
            this.controller.addToken(this.dummyToken);
            this.dummyExit = {
                exitProcessor: this.dummyExitGame.address,
                exitableAt: 1,
                exitId: 123,
            };
        });

        it('rejects when such token has not been added yet', async () => {
            const fakeNonAddedTokenAddress = (await DummyExitGame.new()).address;
            await expectRevert(
                this.controller.processExits(fakeNonAddedTokenAddress, 0, 1),
                "Such token has not be added to the plasma framework yet"
            );
        });

        it('rejects when the exit queue is empty', async () => {
            await expectRevert(
                this.controller.processExits(this.dummyToken, 0, 1),
                "Exit queue is empty"
            );
        });

        it('rejects when the "top unique priority" mismatches with the specified one', async () => {
            await this.dummyExitGame.enqueue(0, this.dummyToken, this.dummyExit);

            const nonExistingUniqeuePriority = 123;
            await expectRevert(
                this.controller.processExits(this.dummyToken, nonExistingUniqeuePriority, 1),
                "Top unique priority of the queue is not the same as the specified one"
            );
        });

        it('processes when the "top unique priority" is set to 0', async () => {
            await this.dummyExitGame.enqueue(0, this.dummyToken, this.dummyExit);

            const tx = await this.controller.processExits(this.dummyToken, 0, 1);
            await expectEvent.inLogs(tx.logs, 'ProcessedExitsNum', {
                processedNum: new BN(1),
                token: this.dummyToken
            });
        });

        it('processes when the "top unique priority" is set to the exact top of the queue', async () => {
            await this.dummyExitGame.enqueue(0, this.dummyToken, this.dummyExit);
            const uniquePriority = await this.dummyExitGame.uniquePriorityFromEnqueue();

            const tx = await this.controller.processExits(this.dummyToken, uniquePriority, 1);
            await expectEvent.inLogs(tx.logs, 'ProcessedExitsNum', {
                processedNum: new BN(1),
                token: this.dummyToken
            });
        });

        it('processes with the order of priority and delete the processed exit from queue', async () => {
            await this.dummyExitGame.enqueue(0, this.dummyToken, this.dummyExit);
            await this.dummyExitGame.enqueue(1, this.dummyToken, this.dummyExit);
            const lowPriority = await this.dummyExitGame.uniquePriorityFromEnqueue();

            await this.controller.processExits(this.dummyToken, 0, 1);

            const priorityQueueAddress = await this.controller.exitsQueues(this.dummyToken);
            const priorityQueue = await PriorityQueue.at(priorityQueueAddress);
            expect(await priorityQueue.getMin()).to.be.bignumber.equal(new BN(lowPriority));
            expect(await priorityQueue.currentSize()).to.be.bignumber.equal(new BN(1));
        });

        it('calls the "processExit" function of the exit processor when processes', async () => {
            await this.dummyExitGame.enqueue(0, this.dummyToken, this.dummyExit);

            const { receipt } = await this.controller.processExits(this.dummyToken, 0, 1);

            await expectEvent.inTransaction(
                receipt.transactionHash, 
                DummyExitGame, 
                'ExitFinalizedFromDummyExitGame', 
                { exitId: new BN(this.dummyExit.exitId) }
            );
        });

        it('deletes the exit data after processed', async () => {
            await this.dummyExitGame.enqueue(0, this.dummyToken, this.dummyExit);
            const uniquePriority = await this.dummyExitGame.uniquePriorityFromEnqueue();

            await this.controller.processExits(this.dummyToken, 0, 1);

            const exit = await this.controller.exits(uniquePriority);
            expect(exit.exitProcessor).to.equal(constants.ZERO_ADDRESS);
            expect(exit.exitableAt).to.be.bignumber.equal(new BN(0));
            expect(exit.exitId).to.be.bignumber.equal(new BN(0));
        });

        it('processes no more than the "maxExitsToProcess" limit', async () => {
            const dummyExit2 = {
                exitProcessor: this.dummyExitGame.address,
                exitableAt: 1,
                exitId: 456,
            };
            await this.dummyExitGame.enqueue(0, this.dummyToken, this.dummyExit);
            await this.dummyExitGame.enqueue(0, this.dummyToken, dummyExit2);
            
            const maxExitsToProcess = 1;
            const tx = await this.controller.processExits(this.dummyToken, 0, maxExitsToProcess);

            await expectEvent.inLogs(tx.logs, 'ProcessedExitsNum', {
                processedNum: new BN(maxExitsToProcess),
                token: this.dummyToken
            });
        });

        it('does not process exit that is not able to exit yet', async () => {
            const INFINITE_TIME = 33134745600; // timestamp of 3020/01/01 00:00:00
            const notAbleToExitYetExit = {
                exitProcessor: this.dummyExitGame.address,
                exitableAt: INFINITE_TIME,
                exitId: 456,
            };
            await this.dummyExitGame.enqueue(0, this.dummyToken, notAbleToExitYetExit);

            const tx = await this.controller.processExits(this.dummyToken, 0, 1);

            await expectEvent.inLogs(tx.logs, 'ProcessedExitsNum', {
                processedNum: new BN(0),
                token: this.dummyToken
            });
        });

        it('stops to process when queue becomes empty', async () => {
            await this.dummyExitGame.enqueue(0, this.dummyToken, this.dummyExit);
            
            const queueSize = 1;
            const maxExitsToProcess = 2;
            const tx = await this.controller.processExits(this.dummyToken, 0, maxExitsToProcess);

            await expectEvent.inLogs(tx.logs, 'ProcessedExitsNum', {
                processedNum: new BN(queueSize),
                token: this.dummyToken
            });
        });
    });
});
