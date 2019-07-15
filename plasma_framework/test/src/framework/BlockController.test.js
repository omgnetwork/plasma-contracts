const BlockController = artifacts.require('BlockController');
const DummyVault = artifacts.require('DummyVault');

const { BN, expectRevert, expectEvent } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('BlockController', ([_, other]) => {
    beforeEach(async () => {
        this.childBlockInterval = 5;
        this.blockController = await BlockController.new(this.childBlockInterval);
        this.dummyBlockHash = web3.utils.keccak256('dummy block');

        this.dummyVault = await DummyVault.new();
        this.dummyVault.setBlockController(this.blockController.address);
        this.dummyVaultId = 1;
        this.blockController.registerVault(this.dummyVaultId, this.dummyVault.address);
    });

    describe('constructor', () => {
        it('nextChildBlock is set to "childBlockInterval"', async () => {
            expect(await this.blockController.nextChildBlock())
                .to.be.bignumber.equal(new BN(this.childBlockInterval));
        });

        it('nextDepositBlock set to 1', async () => {
            expect(await this.blockController.nextDepositBlock()).to.be.bignumber.equal(new BN(1));
        });

        it('childBlockInterval is set as the inserted value', async () => {
            expect(await this.blockController.childBlockInterval())
                .to.be.bignumber.equal(new BN(this.childBlockInterval));
        });
    });

    describe('submitBlock', () => {
        it('saves the child chain block root to contract', async () => {
            await this.blockController.submitBlock(this.dummyBlockHash);

            const block = await this.blockController.blocks(this.childBlockInterval);
            expect(block.root).to.equal(this.dummyBlockHash);
        });

        it('updates "nextChildBlock" with a jump of "childBlockInterval"', async () => {
            const nextChildBlockBeforeSubmission = await this.blockController.nextChildBlock();
            await this.blockController.submitBlock(this.dummyBlockHash);

            expect(await this.blockController.nextChildBlock())
                .to.be.bignumber.equal(nextChildBlockBeforeSubmission.add(new BN(this.childBlockInterval)));
        });

        it('resets "nextDepositBlock" back to 1', async () => {
            // increase nextDepositBlock via deposit
            await this.dummyVault.submitDepositBlock(this.dummyBlockHash);

            await this.blockController.submitBlock(this.dummyBlockHash);

            expect(await this.blockController.nextDepositBlock()).to.be.bignumber.equal(new BN(1));
        });

        it('emits "BlockSubmitted" event', async () => {
            const tx = await this.blockController.submitBlock(this.dummyBlockHash);
            await expectEvent.inLogs(tx.logs, 'BlockSubmitted', { blockNumber: new BN(this.childBlockInterval) });
        });

        it('reverts when not called by operator', async () => {
            await expectRevert(
                this.blockController.submitBlock(this.dummyBlockHash, { from: other }),
                'Not being called by operator',
            );
        });
    });

    describe('submitDepositBlock', () => {
        it('saves the deposit block root to contract', async () => {
            await this.dummyVault.submitDepositBlock(this.dummyBlockHash);

            const firstDepositBlockNum = 1;
            const block = await this.blockController.blocks(firstDepositBlockNum);
            expect(block.root).to.equal(this.dummyBlockHash);
        });

        it('adds 1 to nextDepositBlock', async () => {
            const nextDepositBlockBeforeSubmission = await this.blockController.nextDepositBlock();

            await this.dummyVault.submitDepositBlock(this.dummyBlockHash);

            expect(await this.blockController.nextDepositBlock())
                .to.be.bignumber.equal(nextDepositBlockBeforeSubmission.add(new BN(1)));
        });

        it('does not change nextChildBlock', async () => {
            const nextChildBlockBeforeSubmission = await this.blockController.nextChildBlock();

            await this.dummyVault.submitDepositBlock(this.dummyBlockHash);

            expect(await this.blockController.nextChildBlock()).to.be.bignumber.equal(nextChildBlockBeforeSubmission);
        });

        it('reverts when exceed max deposit amount (childBlockInterval) between two child chain blocks', async () => {
            const promises = Array(this.childBlockInterval - 1).fill().map(
                () => this.dummyVault.submitDepositBlock(this.dummyBlockHash),
            );
            await Promise.all(promises);

            await expectRevert(
                this.dummyVault.submitDepositBlock(this.dummyBlockHash),
                'Exceeded limit of deposits per child block interval',
            );
        });

        it('reverts when not called by registered vault', async () => {
            await expectRevert(
                this.blockController.submitDepositBlock(this.dummyBlockHash),
                'Not being called by registered vaults',
            );
        });
    });
});
