const QuarantineMock = artifacts.require('QuarantineMock');
const { expect } = require('chai');
const { constants, expectRevert, time } = require('openzeppelin-test-helpers');

contract('Quarantine', () => {
    describe('contract is quarantined', () => {
        const QUARANTINE_PERIOD = 3;
        const INITIAL_IMMUNE = 0;

        const dummyAddress = web3.utils.keccak256('dummy address').slice(-40);

        before('setup', async () => {
            this.quarantineMock = await QuarantineMock.new(QUARANTINE_PERIOD, INITIAL_IMMUNE);
            await this.quarantineMock.quarantineContract(dummyAddress);
        });

        it('should return true from isQuarantined when the contract is quarantined', async () => {
            expect(await this.quarantineMock.isQuarantined(dummyAddress)).to.be.true;
        });

        it('should return false from isQuarantined when the quarantine period has passed', async () => {
            await time.increase((QUARANTINE_PERIOD + 1) * 1000);
            expect(await this.quarantineMock.isQuarantined(dummyAddress)).to.be.false;
        });

        it('should revert when attempting to quarantine an empty address', async () => {
            await expectRevert(
                this.quarantineMock.quarantineContract(constants.ZERO_ADDRESS),
                'Can not quarantine an empty address',
            );
        });

        it('should revert when attempting to quarantine a contract again', async () => {
            await expectRevert(
                this.quarantineMock.quarantineContract(dummyAddress),
                'The contract is already quarantined',
            );
        });
    });

    describe('initial immune contract is not quarantined', () => {
        const QUARANTINE_PERIOD = 3;
        const INITIAL_IMMUNE = 1;
        const immuneContractAddress = web3.utils.keccak256('immune contract address').slice(-40);
        const nonImmuneContractAddress = web3.utils.keccak256('non immune contract address').slice(-40);

        before('setup', async () => {
            this.quarantineMock = await QuarantineMock.new(QUARANTINE_PERIOD, INITIAL_IMMUNE);
            await this.quarantineMock.quarantineContract(immuneContractAddress);
            await this.quarantineMock.quarantineContract(nonImmuneContractAddress);
        });

        it('should return true from the initial immune contract', async () => {
            expect(await this.quarantineMock.isQuarantined(immuneContractAddress)).to.be.false;
        });

        it('should revert from the non immune contract', async () => {
            expect(await this.quarantineMock.isQuarantined(nonImmuneContractAddress)).to.be.true;
        });
    });
});
