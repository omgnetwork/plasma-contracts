const PriorityQueue = artifacts.require('PriorityQueue');
const ExitGameController = artifacts.require('ExitGameController');
const DummyExitGame = artifacts.require('DummyExitGame');

const {
    BN, constants, expectEvent, expectRevert,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { buildTxPos } = require('../../helpers/positions.js');

contract('ExitGameController', () => {
    const MIN_EXIT_PERIOD = 10;
    const INITIAL_IMMUNE_EXIT_GAMES = 1;

    beforeEach(async () => {
        this.controller = await ExitGameController.new(MIN_EXIT_PERIOD, INITIAL_IMMUNE_EXIT_GAMES);
        this.dummyExitGame = await DummyExitGame.new();
        this.dummyExitGame.setExitGameController(this.controller.address);

        this.dummyTxType = 1;
        this.controller.registerExitGame(this.dummyTxType, this.dummyExitGame.address);

        // take any random contract address as token
        this.dummyToken = (await DummyExitGame.new()).address;
    });

    describe('constructor', () => {
        it('should init the queue for ETH', async () => {
            const ETH_TOKEN = constants.ZERO_ADDRESS;
            expect(await this.controller.hasToken(ETH_TOKEN)).to.be.true;
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
                'Such token has already been added',
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
        beforeEach(async () => {
            this.dummyExit = {
                token: this.dummyToken,
                exitableAt: 1,
                txPos: buildTxPos(1000, 1),
                exitId: 123,
                exitProcessor: this.dummyExitGame.address,
            };
            this.controller.addToken(this.dummyToken);
        });

        it('rejects when not called from exit game contract', async () => {
            const txPosStruct = { value: this.dummyExit.txPos };
            await expectRevert(
                this.controller.enqueue(
                    constants.ZERO_ADDRESS,
                    this.dummyExit.exitableAt,
                    txPosStruct,
                    this.dummyExit.exitId,
                    this.dummyExit.exitProcessor,
                ),
                'Not being called by registered exit game contract',
            );
        });

        it('rejects when such token has not been added yet', async () => {
            const fakeNonAddedTokenAddress = (await DummyExitGame.new()).address;
            await expectRevert(
                this.dummyExitGame.enqueue(
                    fakeNonAddedTokenAddress,
                    this.dummyExit.exitableAt,
                    this.dummyExit.txPos,
                    this.dummyExit.exitId,
                    this.dummyExit.exitProcessor,
                ),
                'Such token has not been added to the plasma framework yet',
            );
        });

        it('rejects when called from a newly registered (still quarantined) exit game', async () => {
            const newDummyExitGame = await DummyExitGame.new();
            newDummyExitGame.setExitGameController(this.controller.address);
            const newDummyExitGameId = 2;
            await this.controller.registerExitGame(newDummyExitGameId, newDummyExitGame.address);
            await expectRevert(
                newDummyExitGame.enqueue(
                    this.dummyExit.token,
                    this.dummyExit.exitableAt,
                    this.dummyExit.txPos,
                    this.dummyExit.exitId,
                    this.dummyExit.exitProcessor,
                ),
                'ExitGame is quarantined.',
            );
        });

        it('can enqueue with the same exitable timestamp (priority) multiple times', async () => {
            await this.dummyExitGame.enqueue(
                this.dummyExit.token,
                this.dummyExit.exitableAt,
                this.dummyExit.txPos,
                this.dummyExit.exitId,
                this.dummyExit.exitProcessor,
            );

            await this.dummyExitGame.enqueue(
                this.dummyExit.token,
                this.dummyExit.exitableAt,
                this.dummyExit.txPos,
                this.dummyExit.exitId,
                this.dummyExit.exitProcessor,
            );

            const priorityQueueAddress = await this.controller.exitsQueues(this.dummyToken);
            const priorityQueue = await PriorityQueue.at(priorityQueueAddress);
            expect(await priorityQueue.currentSize()).to.be.bignumber.equal(new BN(2));
        });

        it('emits an ExitEnqueued event', async () => {
            const { receipt } = await this.dummyExitGame.enqueue(
                this.dummyExit.token,
                this.dummyExit.exitableAt,
                this.dummyExit.txPos,
                this.dummyExit.exitId,
                this.dummyExit.exitProcessor,
            );

            const uniquePriority = await this.dummyExitGame.uniquePriorityFromEnqueue();

            await expectEvent.inTransaction(
                receipt.transactionHash,
                ExitGameController,
                'ExitQueued', {
                    uniquePriority,
                    exitId: new BN(this.dummyExit.exitId),
                },
            );
        });

        describe('when successfully enqueued', () => {
            beforeEach(async () => {
                this.originExitQueueNonce = await this.controller.exitQueueNonce();

                await this.dummyExitGame.enqueue(
                    this.dummyExit.token,
                    this.dummyExit.exitableAt,
                    this.dummyExit.txPos,
                    this.dummyExit.exitId,
                    this.dummyExit.exitProcessor,
                );
            });

            it('increases `exitQueueNonce` once', async () => {
                expect(await this.controller.exitQueueNonce())
                    .to.be.bignumber.equal(this.originExitQueueNonce.add(new BN(1)));
            });

            it('inserts the new unique priority to the queue', async () => {
                const priorityQueueAddress = await this.controller.exitsQueues(this.dummyToken);
                const priorityQueue = await PriorityQueue.at(priorityQueueAddress);
                const queueMin = await priorityQueue.getMin();

                const uniquePriority = await this.dummyExitGame.uniquePriorityFromEnqueue();

                expect(queueMin).to.be.bignumber.equal(uniquePriority);
            });

            it('saves the exit data to map', async () => {
                const uniquePriority = await this.dummyExitGame.uniquePriorityFromEnqueue();
                const exit = await this.controller.exits(uniquePriority);

                expect(exit.exitProcessor).to.equal(this.dummyExit.exitProcessor);
                expect(exit.exitId).to.be.bignumber.equal(new BN(this.dummyExit.exitId));
            });

            it('should be able to find the exit in the priority queue given exitId', async () => {
                // Search for and ExitQueued event with the exitId
                const events = await this.controller.getPastEvents('ExitQueued', {
                    filter: { exitId: this.dummyExit.exitId },
                });

                // There should be only one ExitQueued event
                expect(events.length).to.equal(1);

                // Get the exit's uniquePriority from the ExitQueued event
                const { uniquePriority } = events[0].args;

                // Find the exit's uniquePriority in the priority queue
                const priorityQueueAddress = await this.controller.exitsQueues(this.dummyToken);
                const priorityQueue = await PriorityQueue.at(priorityQueueAddress);
                const heapList = await priorityQueue.heapList();
                const foundInQueue = heapList.find(e => e.eq(uniquePriority));
                expect(foundInQueue).not.null;
            });
        });
    });

    describe('processExits', () => {
        beforeEach(async () => {
            this.controller.addToken(this.dummyToken);
            this.dummyExit = {
                token: this.dummyToken,
                exitProcessor: this.dummyExitGame.address,
                exitableAt: 1,
                txPos: buildTxPos(1000, 0),
                exitId: 123,
            };
        });

        it('rejects when such token has not been added yet', async () => {
            const fakeNonAddedTokenAddress = (await DummyExitGame.new()).address;
            await expectRevert(
                this.controller.processExits(fakeNonAddedTokenAddress, 0, 1),
                'Such token has not be added to the plasma framework yet',
            );
        });

        it('rejects when the exit queue is empty', async () => {
            await expectRevert(
                this.controller.processExits(this.dummyToken, 0, 1),
                'Exit queue is empty',
            );
        });

        it('rejects when the "top unique priority" mismatches with the specified one', async () => {
            await this.dummyExitGame.enqueue(
                this.dummyExit.token,
                this.dummyExit.exitableAt,
                this.dummyExit.txPos,
                this.dummyExit.exitId,
                this.dummyExit.exitProcessor,
            );

            const nonExistingUniqeuePriority = 123;
            await expectRevert(
                this.controller.processExits(this.dummyToken, nonExistingUniqeuePriority, 1),
                'Top unique priority of the queue is not the same as the specified one',
            );
        });

        it('does not process exit that is not able to exit yet', async () => {
            const UNREACHEABLE_FUTURE = (2 ** 32) - 1; // Sunday, February 7, 2106
            const notAbleToExitYetExit = {
                exitProcessor: this.dummyExitGame.address,
                exitableAt: UNREACHEABLE_FUTURE,
                txPos: buildTxPos(1000, 0),
                exitId: 456,
            };
            await this.dummyExitGame.enqueue(
                this.dummyExit.token,
                notAbleToExitYetExit.exitableAt,
                notAbleToExitYetExit.txPos,
                notAbleToExitYetExit.exitId,
                notAbleToExitYetExit.exitProcessor,
            );

            const tx = await this.controller.processExits(this.dummyToken, 0, 1);

            await expectEvent.inLogs(tx.logs, 'ProcessedExitsNum', {
                processedNum: new BN(0),
                token: this.dummyToken,
            });
        });

        describe('given the queue already has an exitable exit', () => {
            beforeEach(async () => {
                await this.dummyExitGame.enqueue(
                    this.dummyExit.token,
                    this.dummyExit.exitableAt,
                    this.dummyExit.txPos,
                    this.dummyExit.exitId,
                    this.dummyExit.exitProcessor,
                );
            });

            it('should be able to process when the "top unique priority" is set to 0', async () => {
                const tx = await this.controller.processExits(this.dummyToken, 0, 1);
                await expectEvent.inLogs(tx.logs, 'ProcessedExitsNum', {
                    processedNum: new BN(1),
                    token: this.dummyToken,
                });
            });

            it('should be able to process when the "top unique priority" is set to the exact top of the queue', async () => {
                const uniquePriority = await this.dummyExitGame.uniquePriorityFromEnqueue();

                const tx = await this.controller.processExits(this.dummyToken, uniquePriority, 1);
                await expectEvent.inLogs(tx.logs, 'ProcessedExitsNum', {
                    processedNum: new BN(1),
                    token: this.dummyToken,
                });
            });

            it('should call the "processExit" function of the exit processor when processes', async () => {
                const { receipt } = await this.controller.processExits(this.dummyToken, 0, 1);

                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    DummyExitGame,
                    'ExitFinalizedFromDummyExitGame',
                    { exitId: new BN(this.dummyExit.exitId) },
                );
            });

            it('should delete the exit data after processed', async () => {
                const uniquePriority = await this.dummyExitGame.uniquePriorityFromEnqueue();

                await this.controller.processExits(this.dummyToken, 0, 1);

                const exit = await this.controller.exits(uniquePriority);
                expect(exit.exitProcessor).to.equal(constants.ZERO_ADDRESS);
                expect(exit.exitId).to.be.bignumber.equal(new BN(0));
            });

            it('should stop to process when queue becomes empty', async () => {
                const queueSize = 1;
                const maxExitsToProcess = 2;
                const tx = await this.controller.processExits(this.dummyToken, 0, maxExitsToProcess);

                await expectEvent.inLogs(tx.logs, 'ProcessedExitsNum', {
                    processedNum: new BN(queueSize),
                    token: this.dummyToken,
                });
            });
        });

        describe('given multiple exits with different priorities in queue', () => {
            beforeEach(async () => {
                await this.dummyExitGame.enqueue(
                    this.dummyExit.token,
                    this.dummyExit.exitableAt,
                    this.dummyExit.txPos,
                    this.dummyExit.exitId,
                    this.dummyExit.exitProcessor,
                );

                const dummyExitLowerPriority = {
                    token: this.dummyExit.token,
                    exitProcessor: this.dummyExitGame.address,
                    exitableAt: this.dummyExit.exitableAt + 1,
                    txPos: this.dummyExit.txPos,
                    exitId: 456,
                };
                await this.dummyExitGame.enqueue(
                    dummyExitLowerPriority.token,
                    dummyExitLowerPriority.exitableAt,
                    dummyExitLowerPriority.txPos,
                    dummyExitLowerPriority.exitId,
                    dummyExitLowerPriority.exitProcessor,
                );

                this.originalQueueSize = 2;
                this.lowerPriority = await this.dummyExitGame.uniquePriorityFromEnqueue();
            });

            it('should process with the order of priority and delete the processed exit from queue', async () => {
                await this.controller.processExits(this.dummyToken, 0, 1);

                const priorityQueueAddress = await this.controller.exitsQueues(this.dummyToken);
                const priorityQueue = await PriorityQueue.at(priorityQueueAddress);
                expect(await priorityQueue.getMin()).to.be.bignumber.equal(new BN(this.lowerPriority));
                expect(await priorityQueue.currentSize()).to.be.bignumber.equal(new BN(this.originalQueueSize - 1));
            });

            it('should process no more than the "maxExitsToProcess" limit', async () => {
                const maxExitsToProcess = 1;
                const tx = await this.controller.processExits(this.dummyToken, 0, maxExitsToProcess);

                await expectEvent.inLogs(tx.logs, 'ProcessedExitsNum', {
                    processedNum: new BN(maxExitsToProcess),
                    token: this.dummyToken,
                });
            });
        });
    });

    describe('isAnyOutputsSpent', () => {
        it('should return true when checking a spent output', async () => {
            const spentOutputId = web3.utils.sha3('output id');
            await this.dummyExitGame.proxyBatchFlagOutputsSpent([spentOutputId]);
            expect(await this.controller.isAnyOutputsSpent([spentOutputId])).to.be.true;
        });

        it('should return false when checking an unspent output', async () => {
            const unspentOutputId = web3.utils.sha3('output id');
            expect(await this.controller.isAnyOutputsSpent([unspentOutputId])).to.be.false;
        });

        it('should return true when all of the outputs are spent', async () => {
            const dummyOutputId1 = web3.utils.sha3('output id 1');
            const dummyOutputId2 = web3.utils.sha3('output id 2');
            await this.dummyExitGame.proxyBatchFlagOutputsSpent([dummyOutputId1, dummyOutputId2]);
            expect(await this.controller.isAnyOutputsSpent([dummyOutputId1, dummyOutputId2])).to.be.true;
        });

        it('should return true when one of the outputs is spent', async () => {
            const spentOutputId = web3.utils.sha3('output id 1');
            const unspentOutputId = web3.utils.sha3('output id 2');
            await this.dummyExitGame.proxyBatchFlagOutputsSpent([spentOutputId]);
            expect(await this.controller.isAnyOutputsSpent([unspentOutputId, spentOutputId])).to.be.true;
        });

        it('should return false when all of the outputs are not spent', async () => {
            const unspentOutputId1 = web3.utils.sha3('output id 1');
            const unspentOutputId2 = web3.utils.sha3('output id 2');
            expect(await this.controller.isAnyOutputsSpent([unspentOutputId1, unspentOutputId2])).to.be.false;
        });
    });

    describe('batchFlagOutputsSpent', () => {
        it('should be able to flag a single output', async () => {
            const dummyOutputId = web3.utils.sha3('output id');
            await this.dummyExitGame.proxyBatchFlagOutputsSpent([dummyOutputId]);
            expect(await this.controller.isOutputSpent(dummyOutputId)).to.be.true;
        });

        it('should be able to flag multiple outputs', async () => {
            const dummyOutputId1 = web3.utils.sha3('output id 1');
            const dummyOutputId2 = web3.utils.sha3('output id 2');
            await this.dummyExitGame.proxyBatchFlagOutputsSpent([dummyOutputId1, dummyOutputId2]);
            expect(await this.controller.isOutputSpent(dummyOutputId1)).to.be.true;
            expect(await this.controller.isOutputSpent(dummyOutputId2)).to.be.true;
        });

        it('should fail when not called by Exit Game contracts', async () => {
            const dummyOutputId = web3.utils.sha3('output id');
            await expectRevert(
                this.controller.batchFlagOutputsSpent([dummyOutputId]),
                'Not being called by registered exit game contract',
            );
        });

        it('should revert when called on quarantined Exit Game contract', async () => {
            const dummyOutputId1 = web3.utils.sha3('output id 1');
            const dummyOutputId2 = web3.utils.sha3('output id 2');
            const newDummyExitGame = await DummyExitGame.new();
            newDummyExitGame.setExitGameController(this.controller.address);
            const newDummyExitGameId = 2;
            await this.controller.registerExitGame(newDummyExitGameId, newDummyExitGame.address);
            await expectRevert(
                newDummyExitGame.proxyBatchFlagOutputsSpent([dummyOutputId1, dummyOutputId2]),
                'ExitGame is quarantined.',
            );
        });
    });

    describe('flagOutputSpent', () => {
        it('should be able to flag an output', async () => {
            const dummyOutputId = web3.utils.sha3('output id');
            await this.dummyExitGame.proxyFlagOutputSpent(dummyOutputId);
            expect(await this.controller.isOutputSpent(dummyOutputId)).to.be.true;
        });

        it('should fail when not called by Exit Game contracts', async () => {
            const dummyOutputId = web3.utils.sha3('output id');
            await expectRevert(
                this.controller.flagOutputSpent(dummyOutputId),
                'Not being called by registered exit game contract',
            );
        });

        it('should revert when called on quarantined Exit Game contract', async () => {
            const dummyOutputId = web3.utils.sha3('output id');
            const newDummyExitGame = await DummyExitGame.new();
            newDummyExitGame.setExitGameController(this.controller.address);
            const newDummyExitGameId = 2;
            await this.controller.registerExitGame(newDummyExitGameId, newDummyExitGame.address);
            await expectRevert(
                newDummyExitGame.proxyFlagOutputSpent(dummyOutputId),
                'ExitGame is quarantined.',
            );
        });
    });
});
