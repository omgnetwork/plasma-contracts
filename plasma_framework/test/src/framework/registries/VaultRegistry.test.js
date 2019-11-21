const VaultRegistry = artifacts.require('VaultRegistryMock');
const DummyVault = artifacts.require('DummyVault');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('VaultRegistry', ([_, maintainer, other]) => {
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week
    const INITIAL_IMMUNE_VAULTS_NUM = 0;

    beforeEach(async () => {
        this.registry = await VaultRegistry.new(
            MIN_EXIT_PERIOD, INITIAL_IMMUNE_VAULTS_NUM,
        );

        await this.registry.setMaintainer(maintainer);
        this.dummyVault = await DummyVault.new();
    });

    describe('onlyFromNonQuarantinedVault', () => {
        beforeEach(async () => {
            this.dummyVaultId = 1;
            await this.registry.registerVault(this.dummyVaultId, this.dummyVault.address, { from: maintainer });
            await this.dummyVault.setVaultRegistry(this.registry.address);
        });

        it('should accept call when called by registered and non quarantined vault contract', async () => {
            await time.increase(2 * MIN_EXIT_PERIOD + 1);
            expect(await this.dummyVault.checkOnlyFromNonQuarantinedVault()).to.be.true;
        });

        it('should revert when not called by registered vault contract', async () => {
            await expectRevert(
                this.registry.checkOnlyFromNonQuarantinedVault(),
                'The call is not from a registered vault',
            );
        });

        it('should revert when the vault contract is still quarantined', async () => {
            await expectRevert(
                this.dummyVault.checkOnlyFromNonQuarantinedVault(),
                'Vault is quarantined',
            );
        });
    });

    describe('vaults', () => {
        beforeEach(async () => {
            this.dummyVaultId = 1;
            await this.registry.registerVault(this.dummyVaultId, this.dummyVault.address, { from: maintainer });
        });

        it('can receive vault contract address with vault id', async () => {
            expect(await this.registry.vaults(this.dummyVaultId)).to.equal(this.dummyVault.address);
        });
    });

    describe('vaultToId', () => {
        beforeEach(async () => {
            this.dummyVaultId = 1;
            await this.registry.registerVault(this.dummyVaultId, this.dummyVault.address, { from: maintainer });
        });

        it('can receive vault id with vault contract address', async () => {
            expect(await this.registry.vaultToId(this.dummyVault.address))
                .to.be.bignumber.equal(new BN(this.dummyVaultId));
        });
    });

    describe('registerVault', () => {
        it('should save the vault data correctly', async () => {
            const vaultId = 1;
            await this.registry.registerVault(vaultId, this.dummyVault.address, { from: maintainer });
            expect(await this.registry.vaults(vaultId)).to.equal(this.dummyVault.address);
            expect(await this.registry.vaultToId(this.dummyVault.address))
                .to.be.bignumber.equal(new BN(vaultId));
        });

        it('should emit VaultRegistered event', async () => {
            const vaultId = 1;
            const { receipt } = await this.registry.registerVault(
                vaultId, this.dummyVault.address, { from: maintainer },
            );
            await expectEvent.inTransaction(
                receipt.transactionHash,
                VaultRegistry,
                'VaultRegistered',
                {
                    vaultId: new BN(vaultId),
                    vaultAddress: this.dummyVault.address,
                },
            );
        });

        it('rejects when not registered by maintainer', async () => {
            await expectRevert(
                this.registry.registerVault(1, this.dummyVault.address, { from: other }),
                'Caller address is unauthorized',
            );
        });

        it('rejects when trying to register with vault id 0', async () => {
            await expectRevert(
                this.registry.registerVault(0, this.dummyVault.address, { from: maintainer }),
                'Should not register with vault ID 0',
            );
        });

        it('rejects when trying to register with a non-contract address', async () => {
            await expectRevert(
                this.registry.registerVault(1, constants.ZERO_ADDRESS, { from: maintainer }),
                'Should not register with a non-contract address',
            );
        });

        it('rejects when The vault ID is already registered', async () => {
            const vaultId = 1;
            const secondDummyVaultAddress = (await DummyVault.new()).address;
            await this.registry.registerVault(vaultId, this.dummyVault.address, { from: maintainer });
            await expectRevert(
                this.registry.registerVault(vaultId, secondDummyVaultAddress, { from: maintainer }),
                'The vault ID is already registered',
            );
        });

        it('rejects when the the vault contract address is already registered', async () => {
            await this.registry.registerVault(1, this.dummyVault.address, { from: maintainer });
            await expectRevert(
                this.registry.registerVault(2, this.dummyVault.address, { from: maintainer }),
                'The vault contract is already registered',
            );
        });
    });
});
