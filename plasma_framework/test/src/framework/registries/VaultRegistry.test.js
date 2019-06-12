const VaultRegistry = artifacts.require('VaultRegistry');

const { BN, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('VaultRegistry', ([operator, other]) => {
    beforeEach(async () => {
        this.registry = await VaultRegistry.new();
        this.dummyVaultAddress = (await VaultRegistry.new()).address;
    });

    describe('vaults', () => {
        beforeEach(async () => {
            this.dummyVaultId = 1;
            await this.registry.registerVault(this.dummyVaultId, this.dummyVaultAddress);
        });

        it('can receive vault contract address with vault id', async () => {
            expect(await this.registry.vaults(this.dummyVaultId)).to.equal(this.dummyVaultAddress);
        });
    });

    describe('vaultToId', () => {
        beforeEach(async () => {
            this.dummyVaultId = 1;
            await this.registry.registerVault(this.dummyVaultId, this.dummyVaultAddress);
        });

        it('can receive vault id with vault contract address', async () => {
            expect(await this.registry.vaultToId(this.dummyVaultAddress))
                .to.be.bignumber.equal(new BN(this.dummyVaultId));
        });
    });

    describe('registerVault', () => {
        it('can register successfully', async () => {
            const txType = 1;
            await this.registry.registerVault(txType, this.dummyVaultAddress);
            expect(await this.registry.vaults(txType)).to.equal(this.dummyVaultAddress);
            expect(await this.registry.vaultToId(this.dummyVaultAddress))
                .to.be.bignumber.equal(new BN(txType));
        });
    
        it('rejects when not registered by operator', async () => {
            await expectRevert(
                this.registry.registerVault(1, this.dummyVaultAddress, {from: other}),
                "Not being called by operator"
            );
        });

        it('rejects when the vault id is already registered', async () => {
            const txType = 1;
            const secondDummyVaultAddress = (await VaultRegistry.new()).address;
            await this.registry.registerVault(txType, this.dummyVaultAddress);
            await expectRevert(
                this.registry.registerVault(txType, secondDummyVaultAddress),
                "The vault id is already registered"
            );
        });

        it('rejects when the the vault contract address is already registered', async () => {
            await this.registry.registerVault(1, this.dummyVaultAddress);
            await expectRevert(
                this.registry.registerVault(2, this.dummyVaultAddress),
                "The vault contract is already registered"
            );
        });
    });
});
