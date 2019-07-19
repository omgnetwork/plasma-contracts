const ExitGameRegistry = artifacts.require('ExitGameRegistryMock');
const DummyExitGame = artifacts.require('DummyExitGame');

const {
    BN, constants, expectEvent, expectRevert,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('ExitGameRegistry', ([_, other]) => {
    beforeEach(async () => {
        this.registry = await ExitGameRegistry.new();
        this.dummyExitGame = (await DummyExitGame.new());
    });

    describe('onlyFromExitGame', () => {
        beforeEach(async () => {
            this.dummyTxType = 1;
            await this.registry.registerExitGame(this.dummyTxType, this.dummyExitGame.address);
            await this.dummyExitGame.setExitGameRegistry(this.registry.address);
        });

        it('accepts call when called by registered exit game contract', async () => {
            const { receipt } = await this.dummyExitGame.checkOnlyFromExitGame();
            await expectEvent.inTransaction(
                receipt.transactionHash,
                ExitGameRegistry,
                'OnlyFromExitGameChecked',
                {},
            );
        });

        it('reverts when not called by registered exit game contract', async () => {
            await expectRevert(
                this.registry.checkOnlyFromExitGame(),
                'Not being called by registered exit game contract',
            );
        });
    });

    describe('exitGames', () => {
        beforeEach(async () => {
            this.dummyTxType = 1;
            await this.registry.registerExitGame(this.dummyTxType, this.dummyExitGame.address);
        });

        it('can receive exit game address with tx type', async () => {
            expect(await this.registry.exitGames(this.dummyTxType)).to.equal(this.dummyExitGame.address);
        });
    });

    describe('exitGameToTxType', () => {
        beforeEach(async () => {
            this.dummyTxType = 1;
            await this.registry.registerExitGame(this.dummyTxType, this.dummyExitGame.address);
        });

        it('can receive tx type with exit game contract address', async () => {
            expect(await this.registry.exitGameToTxType(this.dummyExitGame.address))
                .to.be.bignumber.equal(new BN(this.dummyTxType));
        });
    });

    describe('registerExitGame', () => {
        it('should save the exit game data correctly', async () => {
            const txType = 1;
            await this.registry.registerExitGame(txType, this.dummyExitGame.address);
            expect(await this.registry.exitGames(txType)).to.equal(this.dummyExitGame.address);
            expect(await this.registry.exitGameToTxType(this.dummyExitGame.address))
                .to.be.bignumber.equal(new BN(txType));
        });

        it('should emit ExitGameRegistered event', async () => {
            const txType = 1;
            const { receipt } = await this.registry.registerExitGame(txType, this.dummyExitGame.address);
            await expectEvent.inTransaction(
                receipt.transactionHash,
                ExitGameRegistry,
                'ExitGameRegistered',
                {
                    txType: new BN(txType),
                    exitGameAddress: this.dummyExitGame.address,
                },
            );
        });

        it('rejects when not registered by operator', async () => {
            await expectRevert(
                this.registry.registerExitGame(1, this.dummyExitGame.address, { from: other }),
                'Not being called by operator',
            );
        });

        it('rejects when trying to register with tx type 0', async () => {
            await expectRevert(
                this.registry.registerExitGame(0, this.dummyExitGame.address),
                'should not register with tx type 0',
            );
        });

        it('rejects when trying to register with empty address', async () => {
            await expectRevert(
                this.registry.registerExitGame(1, constants.ZERO_ADDRESS),
                'should not register with an empty exit game address',
            );
        });

        it('rejects when the tx type is already registered', async () => {
            const txType = 1;
            const secondDummyExitGameAddress = (await DummyExitGame.new()).address;
            await this.registry.registerExitGame(txType, this.dummyExitGame.address);
            await expectRevert(
                this.registry.registerExitGame(txType, secondDummyExitGameAddress),
                'The tx type is already registered',
            );
        });

        it('rejects when the the exit game address is already registered', async () => {
            await this.registry.registerExitGame(1, this.dummyExitGame.address);
            await expectRevert(
                this.registry.registerExitGame(2, this.dummyExitGame.address),
                'The exit game contract is already registered',
            );
        });
    });
});
