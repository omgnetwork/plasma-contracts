const ExitGameRegistry = artifacts.require('ExitGameRegistry');

const { BN, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('ExitGameRegistry', ([operator, other]) => {
    beforeEach(async () => {
        this.registry = await ExitGameRegistry.new();
        this.dummyExitGameAddress = (await ExitGameRegistry.new()).address;
    });

    describe('exitGames', () => {
        beforeEach(async () => {
            this.dummyTxType = 1;
            await this.registry.registerExitGame(this.dummyTxType, this.dummyExitGameAddress);
        });

        it('can receive exit game address with tx type', async () => {
            expect(await this.registry.exitGames(this.dummyTxType)).to.equal(this.dummyExitGameAddress);
        });
    });

    describe('exitGameToTxType', () => {
        beforeEach(async () => {
            this.dummyTxType = 1;
            await this.registry.registerExitGame(this.dummyTxType, this.dummyExitGameAddress);
        });

        it('can receive tx type with exit game contract address', async () => {
            expect(await this.registry.exitGameToTxType(this.dummyExitGameAddress))
                .to.be.bignumber.equal(new BN(this.dummyTxType));
        });
    });

    describe('registerExitGame', () => {
        it('can register successfully', async () => {
            const txType = 1;
            await this.registry.registerExitGame(txType, this.dummyExitGameAddress);
            expect(await this.registry.exitGames(txType)).to.equal(this.dummyExitGameAddress);
            expect(await this.registry.exitGameToTxType(this.dummyExitGameAddress))
                .to.be.bignumber.equal(new BN(txType));
        });
    
        it('rejects when not registered by operator', async () => {
            await expectRevert(
                this.registry.registerExitGame(1, this.dummyExitGameAddress, {from: other}),
                "Not being called by operator"
            );
        });

        it('rejects when the tx type is already registered', async () => {
            const txType = 1;
            const secondDummyExitGameAddress = (await ExitGameRegistry.new()).address;
            await this.registry.registerExitGame(txType, this.dummyExitGameAddress);
            await expectRevert(
                this.registry.registerExitGame(txType, secondDummyExitGameAddress),
                "The tx type is already registered"
            );
        });

        it('rejects when the the exit game address is already registered', async () => {
            await this.registry.registerExitGame(1, this.dummyExitGameAddress);
            await expectRevert(
                this.registry.registerExitGame(2, this.dummyExitGameAddress),
                "The exit game contract is already registered"
            );
        });
    });
});
