const BlockController = artifacts.require('BlockControllerMock');
const DummyVault = artifacts.require('DummyVault');

const {
    BN, constants, expectRevert, expectEvent,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('BlockController', ([maintainer, authority, other]) => {
    const MIN_EXIT_PERIOD = 10;
    const INITIAL_IMMUNE_VAULTS = 1;

    const setup = async () => {
        this.childBlockInterval = 5;
        this.blockController = await BlockController.new(
            this.childBlockInterval,
            MIN_EXIT_PERIOD,
            INITIAL_IMMUNE_VAULTS,
            authority,
        );
        this.blockController.activateChildChain({ from: authority });

        this.dummyBlockHash = web3.utils.keccak256('dummy block');

        this.dummyVault = await DummyVault.new();
        this.dummyVault.setBlockController(this.blockController.address);
        this.dummyVaultId = 1;
        this.blockController.registerVault(this.dummyVaultId, this.dummyVault.address);
    };

    describe('constructor', () => {
        beforeEach(setup);

        it('should set the authority correctly', async () => {
            expect(await this.blockController.authority()).to.equal(authority);
        });

        it('nextChildBlock is set to "childBlockInterval"', async () => {
            expect(await this.blockController.nextChildBlock())
                .to.be.bignumber.equal(new BN(this.childBlockInterval));
        });

        it('nextDeposit set to 1', async () => {
            expect(await this.blockController.nextDeposit()).to.be.bignumber.equal(new BN(1));
        });

        it('childBlockInterval is set as the inserted value', async () => {
            expect(await this.blockController.childBlockInterval())
                .to.be.bignumber.equal(new BN(this.childBlockInterval));
        });

        it('setAuthority rejects zero-address as new authority', async () => {
            await expectRevert(
                this.blockController.setAuthority(constants.ZERO_ADDRESS, { from: authority }),
                'Authority cannot be zero-address',
            );
        });

        it('setAuthority can be called only by the authority', async () => {
            await expectRevert(
                this.blockController.setAuthority(other, { from: other }),
                'Not being called by expected caller',
            );
        });
    });

    describe('activateChildChain', () => {
        describe('before activate', () => {
            beforeEach(async () => {
                const childBlockInterval = 5;
                this.blockController = await BlockController.new(
                    childBlockInterval,
                    MIN_EXIT_PERIOD,
                    INITIAL_IMMUNE_VAULTS,
                    authority,
                );
                this.dummyBlockHash = web3.utils.keccak256('dummy block');
                this.dummyVault = await DummyVault.new();
                this.dummyVault.setBlockController(this.blockController.address);
                this.dummyVaultId = 1;
                this.blockController.registerVault(this.dummyVaultId, this.dummyVault.address);
            });

            it('should not be able to submit child chain block', async () => {
                await expectRevert(
                    this.blockController.submitBlock(this.dummyBlockHash, { from: authority }),
                    'Child chain has not been activate by authority address yet',
                );
            });

            it('should not be able to submit deposit block', async () => {
                await expectRevert(
                    this.dummyVault.submitDepositBlock(this.dummyBlockHash),
                    'Child chain has not been activate by authority address yet',
                );
            });

            it('should not be ablt to be activated by non authority', async () => {
                await expectRevert(
                    this.blockController.activateChildChain({ from: maintainer }),
                    'Not being called by expected caller',
                );
            });

            describe('after activated by authority', () => {
                beforeEach(async () => {
                    this.tx = await this.blockController.activateChildChain({ from: authority });
                });

                it('should change isChildChainActivated flag to true', async () => {
                    expect(await this.blockController.isChildChainActivated()).to.be.true;
                });

                it('should emit ChildChainActivated event', async () => {
                    await expectEvent.inLogs(
                        this.tx.logs,
                        'ChildChainActivated',
                        { authority },
                    );
                });

                it('should not be able to activate again', async () => {
                    await expectRevert(
                        this.blockController.activateChildChain({ from: authority }),
                        'Child chain can only be activated once',
                    );
                });
            });
        });
    });

    describe('submitBlock', () => {
        beforeEach(setup);

        it('saves the child chain block root to contract', async () => {
            await this.blockController.submitBlock(this.dummyBlockHash, { from: authority });

            const block = await this.blockController.blocks(this.childBlockInterval);
            expect(block.root).to.equal(this.dummyBlockHash);
        });

        it('updates "nextChildBlock" with a jump of "childBlockInterval"', async () => {
            const nextChildBlockBeforeSubmission = await this.blockController.nextChildBlock();
            await this.blockController.submitBlock(this.dummyBlockHash, { from: authority });

            expect(await this.blockController.nextChildBlock())
                .to.be.bignumber.equal(nextChildBlockBeforeSubmission.add(new BN(this.childBlockInterval)));
        });

        it('resets "nextDeposit" back to 1', async () => {
            // increase nextDeposit via deposit
            await this.dummyVault.submitDepositBlock(this.dummyBlockHash);

            await this.blockController.submitBlock(this.dummyBlockHash, { from: authority });

            expect(await this.blockController.nextDeposit()).to.be.bignumber.equal(new BN(1));
        });

        it('emits "BlockSubmitted" event', async () => {
            const tx = await this.blockController.submitBlock(this.dummyBlockHash, { from: authority });
            await expectEvent.inLogs(tx.logs, 'BlockSubmitted', { blockNumber: new BN(this.childBlockInterval) });
        });

        it('reverts when not called by authority', async () => {
            await expectRevert(
                this.blockController.submitBlock(this.dummyBlockHash, { from: other }),
                'Not being called by expected caller',
            );
        });

        it('allows authority address to be changed', async () => {
            await expectRevert(
                this.blockController.submitBlock(this.dummyBlockHash, { from: other }),
                'Not being called by expected caller',
            );

            await this.blockController.setAuthority(other, { from: authority });

            await this.blockController.submitBlock(this.dummyBlockHash, { from: other });
        });
    });

    describe('submitDepositBlock', () => {
        beforeEach(setup);

        it('saves the deposit block root to contract', async () => {
            await this.dummyVault.submitDepositBlock(this.dummyBlockHash);

            const firstDepositBlockNum = 1;
            const block = await this.blockController.blocks(firstDepositBlockNum);
            expect(block.root).to.equal(this.dummyBlockHash);
        });

        it('adds 1 to nextDeposit', async () => {
            const nextDepositBeforeSubmission = await this.blockController.nextDeposit();

            await this.dummyVault.submitDepositBlock(this.dummyBlockHash);

            expect(await this.blockController.nextDeposit())
                .to.be.bignumber.equal(nextDepositBeforeSubmission.add(new BN(1)));
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
