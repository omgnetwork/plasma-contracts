const QuarantineRegistryMock = artifacts.require('QuarantineRegistryMock');
const QuarantinedContractMock = artifacts.require('QuarantinedContractMock');
const { expect } = require('chai');
const { expectRevert } = require('openzeppelin-test-helpers');
const { sleep } = require('../../helpers/utils');

contract.only('Quarantine', () => {
    describe('contract is quarantined', () => {
        const QUARANTINE_PERIOD = 3;
        const INITIAL_IMMUNE = 0;

        before('setup', async () => {
            this.quarantineRegistry = await QuarantineRegistryMock.new(QUARANTINE_PERIOD, INITIAL_IMMUNE);
            this.quarantinedContract = await QuarantinedContractMock.new(this.quarantineRegistry.address);
            await this.quarantineRegistry.registerContract(1, this.quarantinedContract.address);
        });

        it('should revert because the contract is quarantined', async () => {
            await expectRevert(this.quarantinedContract.test(), 'Contract is quarantined');
        });

        it('should return true when the quarantine period has passed', async () => {
            await sleep((QUARANTINE_PERIOD + 1) * 1000);
            expect(await this.quarantinedContract.test()).to.be.true;
        });
    });

    describe('initial immune contract is not quarantined', () => {
        const PERIOD = 1000;
        const INITIAL_IMMUNE = 1;

        before('setup', async () => {
            this.quarantineRegistry = await QuarantineRegistryMock.new(PERIOD, INITIAL_IMMUNE);
            this.immuneContract = await QuarantinedContractMock.new(this.quarantineRegistry.address);
            await this.quarantineRegistry.registerContract(1, this.immuneContract.address);

            this.quarantinedContract = await QuarantinedContractMock.new(this.quarantineRegistry.address);
            await this.quarantineRegistry.registerContract(2, this.quarantinedContract.address);
        });

        it('should return true from the initial immune contract', async () => {
            expect(await this.immuneContract.test()).to.be.true;
        });

        it('should revert from the non immune contract', async () => {
            await expectRevert(this.quarantinedContract.test(), 'Contract is quarantined');
        });
    });
});
