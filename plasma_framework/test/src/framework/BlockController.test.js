const BlockController = artifacts.require('BlockController');
const DummyVault = artifacts.require('DummyVault');

const {
    BN, constants, expectRevert, expectEvent,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('BlockController', ([operator, other]) => {
    const MIN_EXIT_PERIOD = 10;
    const INITIAL_IMMUNE_VAULTS = 1;

    beforeEach(async () => {
        this.childBlockInterval = 5;
        this.blockController = await BlockController.new(
            this.childBlockInterval,
            MIN_EXIT_PERIOD,
            INITIAL_IMMUNE_VAULTS,
        );
        this.dummyBlockHash = web3.utils.keccak256('dummy block');

        this.dummyVault = await DummyVault.new();
        this.dummyVault.setBlockController(this.blockController.address);
        this.dummyVaultId = 1;
        this.blockController.registerVault(this.dummyVaultId, this.dummyVault.address);

        // to make these tests easier authority address will be the same as default caller (account[0])
        await this.blockController.initAuthority();
    });

    describe('constructor', () => {
        it('who is operator', async () => {
            // this test only demonstrates assumptions regarding which truffle address deploys contracts
            // and which is default transaction sender address. In both cases this is account[0].
            expect(await this.blockController.operator()).to.equal(operator);
            expect(await this.blockController.authority()).to.equal(operator);
        });

        it('init can be called only once', async () => {
            expect(await this.blockController.authority()).to.equal(operator);

            await expectRevert(
                this.blockController.initAuthority(),
                'Authority address has been already set.',
            );
        });

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

        it('setAuthority rejects zero-address as new authority', async () => {
            await expectRevert(
                this.blockController.setAuthority(constants.ZERO_ADDRESS),
                'Authority cannot be zero-address.',
            );
        });

        it('setAuthority can be called only by the operator', async () => {
            await expectRevert(
                this.blockController.setAuthority(other, { from: other }),
                'Not being called by operator.',
            );
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

        it('reverts when not called by authority', async () => {
            await expectRevert(
                this.blockController.submitBlock(this.dummyBlockHash, { from: other }),
                'Can be called only by the Authority.',
            );
        });

        it('allows authority address to be changed', async () => {
            await expectRevert(
                this.blockController.submitBlock(this.dummyBlockHash, { from: other }),
                'Can be called only by the Authority.',
            );

            await this.blockController.setAuthority(other, { from: operator });

            await this.blockController.submitBlock(this.dummyBlockHash, { from: other });
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

        it('should revert when called from a newly registered (still quarantined) vault', async () => {
            const newDummyVault = await DummyVault.new();
            newDummyVault.setBlockController(this.blockController.address);
            const newDummyVaultId = 2;
            await this.blockController.registerVault(newDummyVaultId, newDummyVault.address);
            await expectRevert(
                newDummyVault.submitDepositBlock(this.dummyBlockHash),
                'Vault is quarantined.',
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
