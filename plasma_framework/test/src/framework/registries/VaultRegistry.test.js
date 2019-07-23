const VaultRegistry = artifacts.require('VaultRegistryMock');
const Quarantine = artifacts.require('Quarantine');
const DummyVault = artifacts.require('DummyVault');

const {
    BN, constants, expectEvent, expectRevert,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('VaultRegistry', ([_, other]) => {
    beforeEach(async () => {
        const quarantine = await Quarantine.new();
        await VaultRegistry.link('Quarantine', quarantine.address);
        this.registry = await VaultRegistry.new();
        this.dummyVault = await DummyVault.new();
    });

    describe('onlyFromVault', () => {
        beforeEach(async () => {
            this.dummyVaultId = 1;
            await this.registry.registerVault(this.dummyVaultId, this.dummyVault.address);
            await this.dummyVault.setVaultRegistry(this.registry.address);
        });

        it('accepts call when called by registered vault contract', async () => {
            const { receipt } = await this.dummyVault.checkOnlyFromVault();
            await expectEvent.inTransaction(
                receipt.transactionHash,
                VaultRegistry,
                'OnlyFromVaultChecked',
                {},
            );
        });

        it('reverts when not called by registered vault contract', async () => {
            await expectRevert(
                this.registry.checkOnlyFromVault(),
                'Not being called by registered vaults',
            );
        });
    });

    describe('vaults', () => {
        beforeEach(async () => {
            this.dummyVaultId = 1;
            await this.registry.registerVault(this.dummyVaultId, this.dummyVault.address);
        });

        it('can receive vault contract address with vault id', async () => {
            expect(await this.registry.vaults(this.dummyVaultId)).to.equal(this.dummyVault.address);
        });
    });

    describe('vaultToId', () => {
        beforeEach(async () => {
            this.dummyVaultId = 1;
            await this.registry.registerVault(this.dummyVaultId, this.dummyVault.address);
        });

        it('can receive vault id with vault contract address', async () => {
            expect(await this.registry.vaultToId(this.dummyVault.address))
                .to.be.bignumber.equal(new BN(this.dummyVaultId));
        });
    });

    describe('registerVault', () => {
        it('should save the vault data correctly', async () => {
            const vaultId = 1;
            await this.registry.registerVault(vaultId, this.dummyVault.address);
            expect(await this.registry.vaults(vaultId)).to.equal(this.dummyVault.address);
            expect(await this.registry.vaultToId(this.dummyVault.address))
                .to.be.bignumber.equal(new BN(vaultId));
        });

        it('should emit VaultRegistered event', async () => {
            const vaultId = 1;
            const { receipt } = await this.registry.registerVault(vaultId, this.dummyVault.address);
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

        it('rejects when not registered by operator', async () => {
            await expectRevert(
                this.registry.registerVault(1, this.dummyVault.address, { from: other }),
                'Not being called by operator',
            );
        });

        it('rejects when trying to register with vault id 0', async () => {
            await expectRevert(
                this.registry.registerVault(0, this.dummyVault.address),
                'should not register with vault id 0',
            );
        });

        it('rejects when trying to register with an empty vault address', async () => {
            await expectRevert(
                this.registry.registerVault(1, constants.ZERO_ADDRESS),
                'should not register an empty vault address',
            );
        });

        it('rejects when the vault id is already registered', async () => {
            const vaultId = 1;
            const secondDummyVaultAddress = (await VaultRegistry.new()).address;
            await this.registry.registerVault(vaultId, this.dummyVault.address);
            await expectRevert(
                this.registry.registerVault(vaultId, secondDummyVaultAddress),
                'The vault id is already registered',
            );
        });

        it('rejects when the the vault contract address is already registered', async () => {
            await this.registry.registerVault(1, this.dummyVault.address);
            await expectRevert(
                this.registry.registerVault(2, this.dummyVault.address),
                'The vault contract is already registered',
            );
        });
    });
});
