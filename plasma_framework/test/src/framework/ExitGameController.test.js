const PriorityQueue = artifacts.require('PriorityQueue');
const ExitGameController = artifacts.require('ExitGameControllerMock');
const DummyExitGame = artifacts.require('DummyExitGame');
const ReentrancyExitGame = artifacts.require('ReentrancyExitGame');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { buildTxPos } = require('../../helpers/positions.js');
const { PROTOCOL, EMPTY_BYTES_32 } = require('../../helpers/constants.js');
const { exitQueueKey } = require('../../helpers/utils.js');

contract('ExitGameController', ([otherAddress]) => {
    const MIN_EXIT_PERIOD = 10;
    const INITIAL_IMMUNE_EXIT_GAMES = 1;
    const VAULT_ID = 1;
    const EXIT_ID = 1;
    const OTHER_EXIT_ID = 2;

    beforeEach(async () => {
        this.controller = await ExitGameController.new(MIN_EXIT_PERIOD, INITIAL_IMMUNE_EXIT_GAMES);
        this.dummyExitGame = await DummyExitGame.new();
        await this.dummyExitGame.setExitGameController(this.controller.address);

        this.dummyTxType = 1;
        await this.controller.registerExitGame(this.dummyTxType, this.dummyExitGame.address, PROTOCOL.MORE_VP);

        // take any random contract address as token
        this.dummyToken = (await DummyExitGame.new()).address;
    });

    describe('addExitQueue', () => {
        beforeEach('exit queue is added', async () => {
            this.queueAddedReceipt = await this.controller.addExitQueue(VAULT_ID, this.dummyToken);
        });

        it('generates a priority queue instance to the exitsQueues map', async () => {
            const key = exitQueueKey(VAULT_ID, this.dummyToken);
            const priorityQueue = await this.controller.exitsQueues(key);
            expect(priorityQueue).to.not.equal(constants.ZERO_ADDRESS);
        });

        it('emits event', async () => {
            await expectEvent.inLogs(this.queueAddedReceipt.logs, 'ExitQueueAdded', { vaultId: new BN(VAULT_ID), token: this.dummyToken });
        });

        it('reverts when adding the same queue', async () => {
            await expectRevert(
                this.controller.addExitQueue(VAULT_ID, this.dummyToken),
                'Exit queue exists',
            );
        });

        it('reverts when adding queue with vault id 0', async () => {
            await expectRevert(
                this.controller.addExitQueue(0, this.dummyToken),
                'Vault ID must not be 0.',
            );
        });
    });

    describe('hasExitQueue', () => {
        it('returns true when queue is added', async () => {
            await this.controller.addExitQueue(VAULT_ID, this.dummyToken);
            expect(await this.controller.hasExitQueue(VAULT_ID, this.dummyToken)).to.be.true;
        });

        it('returns false when queue not added', async () => {
            expect(await this.controller.hasExitQueue(VAULT_ID, this.dummyToken)).to.be.false;
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
            this.controller.addExitQueue(VAULT_ID, this.dummyToken);
        });

        it('rejects when not called from exit game contract', async () => {
            const txPos = {
                blockNum: 1000,
                txIndex: 1,
                outputIndex: 0,
            };
            await expectRevert(
                this.controller.enqueue(
                    VAULT_ID,
                    constants.ZERO_ADDRESS,
                    this.dummyExit.exitableAt,
                    txPos,
                    this.dummyExit.exitId,
                    this.dummyExit.exitProcessor,
                ),
                'The call is not from a registered exit game contract',
            );
        });

        it('rejects when such token has not been added yet', async () => {
            const fakeNonAddedTokenAddress = (await DummyExitGame.new()).address;
            await expectRevert(
                this.dummyExitGame.enqueue(
                    VAULT_ID,
                    fakeNonAddedTokenAddress,
                    this.dummyExit.exitableAt,
                    this.dummyExit.txPos,
                    this.dummyExit.exitId,
                    this.dummyExit.exitProcessor,
                ),
                'The queue for the (vaultId, token) pair is not yet added to the Plasma framework',
            );
        });

        it('rejects when called from a newly registered (still quarantined) exit game', async () => {
            const newDummyExitGame = await DummyExitGame.new();
            newDummyExitGame.setExitGameController(this.controller.address);
            const newDummyExitGameId = 2;
            await this.controller.registerExitGame(newDummyExitGameId, newDummyExitGame.address, PROTOCOL.MORE_VP);
            await expectRevert(
                newDummyExitGame.enqueue(
                    VAULT_ID,
                    this.dummyExit.token,
                    this.dummyExit.exitableAt,
                    this.dummyExit.txPos,
                    this.dummyExit.exitId,
                    this.dummyExit.exitProcessor,
                ),
                'ExitGame is quarantined',
            );
        });

        it('rejects when the same priority is already enqueued', async () => {
            await this.dummyExitGame.enqueue(
                VAULT_ID,
                this.dummyExit.token,
                this.dummyExit.exitableAt,
                this.dummyExit.txPos,
                this.dummyExit.exitId,
                this.dummyExit.exitProcessor,
            );

            await expectRevert(
                this.dummyExitGame.enqueue(
                    VAULT_ID,
                    this.dummyExit.token,
                    this.dummyExit.exitableAt,
                    this.dummyExit.txPos,
                    this.dummyExit.exitId,
                    this.dummyExit.exitProcessor,
                ),
                'The same priority is already enqueued',
            );
        });

        it('can enqueue with the exact same priority to different priority queue', async () => {
            const vaultId2 = VAULT_ID + 1;
            await this.controller.addExitQueue(vaultId2, this.dummyToken);

            await this.dummyExitGame.enqueue(
                VAULT_ID,
                this.dummyExit.token,
                this.dummyExit.exitableAt,
                this.dummyExit.txPos,
                this.dummyExit.exitId,
                this.dummyExit.exitProcessor,
            );

            await this.dummyExitGame.enqueue(
                vaultId2,
                this.dummyExit.token,
                this.dummyExit.exitableAt,
                this.dummyExit.txPos,
                this.dummyExit.exitId,
                this.dummyExit.exitProcessor,
            );

            const key = exitQueueKey(VAULT_ID, this.dummyToken);
            const priorityQueueAddress = await this.controller.exitsQueues(key);
            const priorityQueue = await PriorityQueue.at(priorityQueueAddress);
            expect(await priorityQueue.currentSize()).to.be.bignumber.equal(new BN(1));

            const key2 = exitQueueKey(vaultId2, this.dummyToken);
            const priorityQueueAddress2 = await this.controller.exitsQueues(key2);
            const priorityQueue2 = await PriorityQueue.at(priorityQueueAddress2);
            expect(await priorityQueue2.currentSize()).to.be.bignumber.equal(new BN(1));
        });

        it('can enqueue with the same exitable timestamp and txPos but with different exitId multiple times to the same queue', async () => {
            const exitId1 = 111111;
            const exitId2 = 22222;
            await this.dummyExitGame.enqueue(
                VAULT_ID,
                this.dummyExit.token,
                this.dummyExit.exitableAt,
                this.dummyExit.txPos,
                exitId1,
                this.dummyExit.exitProcessor,
            );

            await this.dummyExitGame.enqueue(
                VAULT_ID,
                this.dummyExit.token,
                this.dummyExit.exitableAt,
                this.dummyExit.txPos,
                exitId2,
                this.dummyExit.exitProcessor,
            );

            const key = exitQueueKey(VAULT_ID, this.dummyToken);
            const priorityQueueAddress = await this.controller.exitsQueues(key);
            const priorityQueue = await PriorityQueue.at(priorityQueueAddress);
            expect(await priorityQueue.currentSize()).to.be.bignumber.equal(new BN(2));
        });

        describe('when successfully enqueued', () => {
            beforeEach(async () => {
                this.enqueueTx = await this.dummyExitGame.enqueue(
                    VAULT_ID,
                    this.dummyExit.token,
                    this.dummyExit.exitableAt,
                    this.dummyExit.txPos,
                    this.dummyExit.exitId,
                    this.dummyExit.exitProcessor,
                );
            });

            it('inserts the new priority to the queue', async () => {
                const key = exitQueueKey(VAULT_ID, this.dummyToken);
                const priorityQueueAddress = await this.controller.exitsQueues(key);
                const priorityQueue = await PriorityQueue.at(priorityQueueAddress);
                const queueMin = await priorityQueue.getMin();

                const priority = await this.dummyExitGame.priorityFromEnqueue();

                expect(queueMin).to.be.bignumber.equal(priority);
            });

            it('saves the exit data to map', async () => {
                const priority = await this.dummyExitGame.priorityFromEnqueue();
                const delegationKey = web3.utils.soliditySha3(priority, VAULT_ID, this.dummyExit.token);
                const exitProcessor = await this.controller.delegations(delegationKey);

                expect(exitProcessor).to.equal(this.dummyExit.exitProcessor);
            });

            it('emits an ExitEnqueued event', async () => {
                const priority = await this.dummyExitGame.priorityFromEnqueue();

                await expectEvent.inTransaction(
                    this.enqueueTx.receipt.transactionHash,
                    ExitGameController,
                    'ExitQueued', {
                        priority,
                        exitId: new BN(this.dummyExit.exitId),
                    },
                );
            });

            it('should be able to find the exit in the priority queue given exitId', async () => {
                // Search for and ExitQueued event with the exitId
                const events = await this.controller.getPastEvents('ExitQueued', {
                    filter: { exitId: this.dummyExit.exitId },
                });

                // There should be only one ExitQueued event
                expect(events.length).to.equal(1);

                // Get the exit's priority from the ExitQueued event
                const { priority } = events[0].args;

                // Find the exit's priority in the priority queue
                const key = exitQueueKey(VAULT_ID, this.dummyToken);
                const priorityQueueAddress = await this.controller.exitsQueues(key);
                const priorityQueue = await PriorityQueue.at(priorityQueueAddress);
                const heapList = await priorityQueue.heapList();
                const foundInQueue = heapList.find(e => e.eq(priority));
                expect(foundInQueue).not.null;
            });

            it('should provide convenience method to show top exit priority', async () => {
                // Search for and ExitQueued event with the exitId
                const events = await this.controller.getPastEvents('ExitQueued', {
                    filter: { exitId: this.dummyExit.exitId },
                });

                // Get the exit's priority from the ExitQueued event
                const { priority } = events[0].args;

                // Find the exit's priority in the priority queue
                const nextExitPriority = await this.controller.getNextExit(VAULT_ID, this.dummyToken);
                expect(nextExitPriority).to.be.bignumber.equal(priority);
            });
        });
    });

    describe('processExits', () => {
        beforeEach(async () => {
            this.controller.addExitQueue(VAULT_ID, this.dummyToken);
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
                this.controller.processExits(
                    VAULT_ID,
                    fakeNonAddedTokenAddress,
                    0,
                    1,
                    web3.utils.keccak256(otherAddress),
                    { from: otherAddress },
                ),
                'The token is not yet added to the Plasma framework',
            );
        });

        it('rejects when the exit queue is empty', async () => {
            await expectRevert(
                this.controller.processExits(
                    VAULT_ID,
                    this.dummyToken,
                    0,
                    1,
                    web3.utils.keccak256(otherAddress),
                    { from: otherAddress },
                ),
                'Exit queue is empty',
            );
        });

        it('rejects when senderData is incorrect', async () => {
            await expectRevert(
                this.controller.processExits(
                    VAULT_ID,
                    this.dummyToken,
                    0,
                    1,
                    web3.utils.keccak256(this.controller.address),
                    { from: otherAddress },
                ),
                'Incorrect SenderData',
            );
        });

        it('rejects when the top exit id mismatches with the specified one', async () => {
            await this.dummyExitGame.enqueue(
                VAULT_ID,
                this.dummyExit.token,
                this.dummyExit.exitableAt,
                this.dummyExit.txPos,
                this.dummyExit.exitId,
                this.dummyExit.exitProcessor,
            );

            const nonExistingExitId = this.dummyExit.exitId - 1;
            await expectRevert(
                this.controller.processExits(
                    VAULT_ID,
                    this.dummyToken,
                    nonExistingExitId,
                    1,
                    web3.utils.keccak256(otherAddress),
                    { from: otherAddress },
                ),
                'Top exit ID of the queue is different to the one specified',
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
                VAULT_ID,
                this.dummyExit.token,
                notAbleToExitYetExit.exitableAt,
                notAbleToExitYetExit.txPos,
                notAbleToExitYetExit.exitId,
                notAbleToExitYetExit.exitProcessor,
            );

            const tx = await this.controller.processExits(
                VAULT_ID,
                this.dummyToken,
                0,
                1,
                web3.utils.keccak256(otherAddress),
                { from: otherAddress },
            );

            await expectEvent.inLogs(tx.logs, 'ProcessedExitsNum', {
                processedNum: new BN(0),
                token: this.dummyToken,
            });
        });

        describe('given the queue already has an exitable exit', () => {
            beforeEach(async () => {
                await this.dummyExitGame.enqueue(
                    VAULT_ID,
                    this.dummyExit.token,
                    this.dummyExit.exitableAt,
                    this.dummyExit.txPos,
                    this.dummyExit.exitId,
                    this.dummyExit.exitProcessor,
                );
            });

            it('should process the exit when the exitId is set to 0', async () => {
                const tx = await this.controller.processExits(
                    VAULT_ID,
                    this.dummyToken,
                    0,
                    1,
                    web3.utils.keccak256(otherAddress),
                    { from: otherAddress },
                );
                await expectEvent.inLogs(tx.logs, 'ProcessedExitsNum', {
                    processedNum: new BN(1),
                    token: this.dummyToken,
                });
            });

            it('should process an exit for the same token and exitId but a different vault', async () => {
                const otherVaultId = VAULT_ID + 1;
                await this.controller.addExitQueue(otherVaultId, this.dummyToken);

                await this.dummyExitGame.enqueue(
                    otherVaultId,
                    this.dummyExit.token,
                    this.dummyExit.exitableAt,
                    this.dummyExit.txPos,
                    this.dummyExit.exitId,
                    this.dummyExit.exitProcessor,
                );

                await this.controller.processExits(
                    VAULT_ID,
                    this.dummyToken,
                    0,
                    1,
                    web3.utils.keccak256(otherAddress),
                    { from: otherAddress },
                );

                const tx = await this.controller.processExits(
                    otherVaultId,
                    this.dummyToken,
                    0,
                    1,
                    web3.utils.keccak256(otherAddress),
                    { from: otherAddress },
                );
                await expectEvent.inLogs(tx.logs, 'ProcessedExitsNum', {
                    processedNum: new BN(1),
                    token: this.dummyToken,
                });
            });

            it('should process the exit when the exitId is set to the exact top of the queue', async () => {
                const tx = await this.controller.processExits(
                    VAULT_ID, this.dummyToken, this.dummyExit.exitId, 1, web3.utils.keccak256(otherAddress),
                    { from: otherAddress },
                );
                await expectEvent.inLogs(tx.logs, 'ProcessedExitsNum', {
                    processedNum: new BN(1),
                    token: this.dummyToken,
                });
            });

            it('should call the "processExit" function of the exit processor when processes', async () => {
                const { receipt } = await this.controller.processExits(
                    VAULT_ID,
                    this.dummyToken,
                    0,
                    1,
                    web3.utils.keccak256(otherAddress),
                    { from: otherAddress },
                );

                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    DummyExitGame,
                    'ExitFinalizedFromDummyExitGame',
                    { exitId: new BN(this.dummyExit.exitId), ercContract: this.dummyToken },
                );
            });

            it('should delete the exit data after processed', async () => {
                const priority = await this.dummyExitGame.priorityFromEnqueue();

                await this.controller.processExits(
                    VAULT_ID,
                    this.dummyToken,
                    0,
                    1,
                    web3.utils.keccak256(otherAddress),
                    { from: otherAddress },
                );

                const delegationKey = web3.utils.soliditySha3(priority, VAULT_ID, this.dummyExit.token);
                const exitProcessor = await this.controller.delegations(delegationKey);
                expect(exitProcessor).to.equal(constants.ZERO_ADDRESS);
            });

            it('should stop to process when queue becomes empty', async () => {
                const queueSize = 1;
                const maxExitsToProcess = 2;
                const tx = await this.controller.processExits(
                    VAULT_ID,
                    this.dummyToken,
                    0,
                    maxExitsToProcess,
                    web3.utils.keccak256(otherAddress),
                    { from: otherAddress },
                );

                await expectEvent.inLogs(tx.logs, 'ProcessedExitsNum', {
                    processedNum: new BN(queueSize),
                    token: this.dummyToken,
                });
            });
        });

        describe('given multiple exits with different priorities in queue', () => {
            beforeEach(async () => {
                await this.dummyExitGame.enqueue(
                    VAULT_ID,
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
                    VAULT_ID,
                    dummyExitLowerPriority.token,
                    dummyExitLowerPriority.exitableAt,
                    dummyExitLowerPriority.txPos,
                    dummyExitLowerPriority.exitId,
                    dummyExitLowerPriority.exitProcessor,
                );

                this.originalQueueSize = 2;
                this.lowerPriority = await this.dummyExitGame.priorityFromEnqueue();
            });

            it('should process with the order of priority and delete the processed exit from queue', async () => {
                await this.controller.processExits(
                    VAULT_ID,
                    this.dummyToken,
                    0,
                    1,
                    web3.utils.keccak256(otherAddress),
                    { from: otherAddress },
                );

                const key = exitQueueKey(VAULT_ID, this.dummyToken);
                const priorityQueueAddress = await this.controller.exitsQueues(key);
                const priorityQueue = await PriorityQueue.at(priorityQueueAddress);
                expect(await priorityQueue.getMin()).to.be.bignumber.equal(new BN(this.lowerPriority));
                expect(await priorityQueue.currentSize()).to.be.bignumber.equal(new BN(this.originalQueueSize - 1));
            });

            it('should process no more than the "maxExitsToProcess" limit', async () => {
                const maxExitsToProcess = 1;
                const tx = await this.controller.processExits(
                    VAULT_ID,
                    this.dummyToken,
                    0,
                    maxExitsToProcess,
                    web3.utils.keccak256(otherAddress),
                    { from: otherAddress },
                );

                await expectEvent.inLogs(tx.logs, 'ProcessedExitsNum', {
                    processedNum: new BN(maxExitsToProcess),
                    token: this.dummyToken,
                });
            });
        });
    });

    describe('isAnyInputFinalizedByOtherExit', () => {
        it('should return true when any of the outputs is spent by other exit', async () => {
            const dummyOutputId1 = web3.utils.sha3('output id 1');
            const dummyOutputId2 = web3.utils.sha3('output id 2');
            await this.dummyExitGame.proxyBatchFlagOutputsFinalized([dummyOutputId1], OTHER_EXIT_ID);
            await this.dummyExitGame.proxyBatchFlagOutputsFinalized([dummyOutputId2], EXIT_ID);
            expect(
                await this.controller.isAnyInputFinalizedByOtherExit([dummyOutputId1, dummyOutputId2], EXIT_ID),
            ).to.be.true;
        });

        it('should return false when checking an unspent output', async () => {
            const unspentOutputId = web3.utils.sha3('output id');
            expect(await this.controller.isAnyInputFinalizedByOtherExit([unspentOutputId], EXIT_ID)).to.be.false;
        });

        it('should return false when output is finalized by the same exit', async () => {
            const outputId = web3.utils.sha3('output id');
            await this.dummyExitGame.proxyBatchFlagOutputsFinalized([outputId], EXIT_ID);
            expect(await this.controller.isAnyInputFinalizedByOtherExit([outputId], EXIT_ID)).to.be.false;
        });

        it('should return true when all of the outputs are finalized by other exit', async () => {
            const dummyOutputId1 = web3.utils.sha3('output id 1');
            const dummyOutputId2 = web3.utils.sha3('output id 2');
            await this.dummyExitGame.proxyBatchFlagOutputsFinalized([dummyOutputId1, dummyOutputId2], OTHER_EXIT_ID);
            expect(
                await this.controller.isAnyInputFinalizedByOtherExit([dummyOutputId1, dummyOutputId2], EXIT_ID),
            ).to.be.true;
        });

        it('should return false when one of the outputs is spent', async () => {
            const spentOutputId = web3.utils.sha3('output id 1');
            const unspentOutputId = web3.utils.sha3('output id 2');
            await this.dummyExitGame.proxyBatchFlagOutputsFinalized([spentOutputId], EXIT_ID);
            expect(
                await this.controller.isAnyInputFinalizedByOtherExit([unspentOutputId, spentOutputId], EXIT_ID),
            ).to.be.false;
        });

        it('should return false when all of the outputs are not spent', async () => {
            const unspentOutputId1 = web3.utils.sha3('output id 1');
            const unspentOutputId2 = web3.utils.sha3('output id 2');
            expect(
                await this.controller.isAnyInputFinalizedByOtherExit([unspentOutputId1, unspentOutputId2], EXIT_ID),
            ).to.be.false;
        });
    });

    describe('batchFlagOutputsFinalized', () => {
        it('should be able to flag a single output', async () => {
            const dummyOutputId = web3.utils.sha3('output id');
            await this.dummyExitGame.proxyBatchFlagOutputsFinalized([dummyOutputId], EXIT_ID);
            expect(await this.controller.isOutputFinalized(dummyOutputId)).to.be.true;
        });

        it('should be able to flag multiple outputs', async () => {
            const dummyOutputId1 = web3.utils.sha3('output id 1');
            const dummyOutputId2 = web3.utils.sha3('output id 2');
            await this.dummyExitGame.proxyBatchFlagOutputsFinalized([dummyOutputId1, dummyOutputId2], EXIT_ID);
            expect(await this.controller.isOutputFinalized(dummyOutputId1)).to.be.true;
            expect(await this.controller.isOutputFinalized(dummyOutputId2)).to.be.true;
        });

        it('should fail when try to flag with empty outputId', async () => {
            const dummyOutputId = web3.utils.sha3('output id');
            await expectRevert(
                this.dummyExitGame.proxyBatchFlagOutputsFinalized([dummyOutputId, EMPTY_BYTES_32], EXIT_ID),
                'Should not flag with empty outputId',
            );
        });

        it('should fail when not called by Exit Game contracts', async () => {
            const dummyOutputId = web3.utils.sha3('output id');
            await expectRevert(
                this.controller.batchFlagOutputsFinalized([dummyOutputId], EXIT_ID),
                'The call is not from a registered exit game contract',
            );
        });

        it('should not override exitId when flagging multiple times', async () => {
            const dummyOutputId1 = web3.utils.sha3('output id 1');
            const dummyOutputId2 = web3.utils.sha3('output id 2');
            const overridingExitId = EXIT_ID + 1;
            await this.dummyExitGame.proxyBatchFlagOutputsFinalized([dummyOutputId1], EXIT_ID);
            await this.dummyExitGame.proxyBatchFlagOutputsFinalized([dummyOutputId1, dummyOutputId2], overridingExitId);
            expect(await this.controller.outputsFinalizations(dummyOutputId1)).to.be.bignumber.equal(new BN(EXIT_ID));
            expect(
                await this.controller.outputsFinalizations(dummyOutputId2),
            ).to.be.bignumber.equal(new BN(overridingExitId));
        });

        it('should revert when called on quarantined Exit Game contract', async () => {
            const dummyOutputId1 = web3.utils.sha3('output id 1');
            const dummyOutputId2 = web3.utils.sha3('output id 2');
            const newDummyExitGame = await DummyExitGame.new();
            newDummyExitGame.setExitGameController(this.controller.address);
            const newDummyExitGameId = 2;
            await this.controller.registerExitGame(newDummyExitGameId, newDummyExitGame.address, PROTOCOL.MORE_VP);
            await expectRevert(
                newDummyExitGame.proxyBatchFlagOutputsFinalized([dummyOutputId1, dummyOutputId2], EXIT_ID),
                'ExitGame is quarantined',
            );
        });

        it('should fail when reentrancy attack on processExits happens', async () => {
            this.controller.addExitQueue(VAULT_ID, this.dummyExit.token);
            const reentrancyExitGame = await ReentrancyExitGame.new(
                this.controller.address, VAULT_ID, this.dummyExit.token, 1,
            );
            const txType = 999;
            await this.controller.registerExitGame(
                txType, reentrancyExitGame.address, PROTOCOL.MORE_VP,
            );

            // bypass quarantined period
            await time.increase(4 * MIN_EXIT_PERIOD + 1);

            await reentrancyExitGame.enqueue(
                VAULT_ID,
                this.dummyExit.token,
                this.dummyExit.exitableAt,
                this.dummyExit.txPos,
                this.dummyExit.exitId,
                reentrancyExitGame.address,
            );

            await expectRevert(
                this.controller.processExits(
                    VAULT_ID,
                    this.dummyExit.token,
                    0,
                    1,
                    web3.utils.keccak256(otherAddress),
                    { from: otherAddress },
                ),
                'Reentrant call',
            );
        });
    });

    describe('flagOutputFinalized', () => {
        it('should be able to flag an output', async () => {
            const dummyOutputId = web3.utils.sha3('output id');
            await this.dummyExitGame.proxyFlagOutputFinalized(dummyOutputId, EXIT_ID);
            expect(await this.controller.isOutputFinalized(dummyOutputId)).to.be.true;
        });

        it('should not override exitId when flagging multiple times', async () => {
            const dummyOutputId1 = web3.utils.sha3('output id 1');
            const overridingExitId = EXIT_ID + 1;
            await this.dummyExitGame.proxyFlagOutputFinalized(dummyOutputId1, EXIT_ID);
            await this.dummyExitGame.proxyFlagOutputFinalized(dummyOutputId1, overridingExitId);
            expect(await this.controller.outputsFinalizations(dummyOutputId1)).to.be.bignumber.equal(new BN(EXIT_ID));
        });

        it('should fail when try to flag withempty outputId', async () => {
            await expectRevert(
                this.dummyExitGame.proxyFlagOutputFinalized(EMPTY_BYTES_32, EXIT_ID),
                'Should not flag with empty outputId',
            );
        });

        it('should fail when not called by Exit Game contracts', async () => {
            const dummyOutputId = web3.utils.sha3('output id');
            await expectRevert(
                this.controller.flagOutputFinalized(dummyOutputId, EXIT_ID),
                'The call is not from a registered exit game contract',
            );
        });

        it('should revert when called on quarantined Exit Game contract', async () => {
            const dummyOutputId = web3.utils.sha3('output id');
            const newDummyExitGame = await DummyExitGame.new();
            newDummyExitGame.setExitGameController(this.controller.address);
            const newDummyExitGameId = 2;
            await this.controller.registerExitGame(newDummyExitGameId, newDummyExitGame.address, PROTOCOL.MORE_VP);
            await expectRevert(
                newDummyExitGame.proxyFlagOutputFinalized(dummyOutputId, EXIT_ID),
                'ExitGame is quarantined',
            );
        });
    });
});
