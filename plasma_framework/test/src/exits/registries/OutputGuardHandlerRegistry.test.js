const OutputGuardHandlerRegistry = artifacts.require('OutputGuardHandlerRegistry');
const ExpectedOutputGuardHandler = artifacts.require('ExpectedOutputGuardHandler');

const { constants, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('OutputGuardHandlerRegistry', ([_, other]) => {
    beforeEach(async () => {
        this.dummyOutputGuardHandler = await ExpectedOutputGuardHandler.new(true, constants.ZERO_ADDRESS);
        this.registry = await OutputGuardHandlerRegistry.new();
    });

    describe('outputGuardRegisters', () => {
        it('should get empty address if not registered', async () => {
            const nonRegisteredOutputType = 999;
            expect(await this.registry.outputGuardHandlers(nonRegisteredOutputType)).to.equal(constants.ZERO_ADDRESS);
        });
    });

    describe('registerOutputGuardHandler', () => {
        it('should be able to register successfully', async () => {
            const outputType = 1;
            await this.registry.registerOutputGuardHandler(outputType, this.dummyOutputGuardHandler.address);
            expect(await this.registry.outputGuardHandlers(outputType)).to.equal(this.dummyOutputGuardHandler.address);
        });

        it('should reject when not registered by owner', async () => {
            await expectRevert(
                this.registry.registerOutputGuardHandler(1, this.dummyOutputGuardHandler.address, { from: other }),
                'Ownable: caller is not the owner',
            );
        });

        it('should not be able to register after renouncing the ownership', async () => {
            const outputType = 1;
            await this.registry.renounceOwnership();
            await expectRevert(
                this.registry.registerOutputGuardHandler(
                    outputType, this.dummyOutputGuardHandler.address,
                ),
                'Ownable: caller is not the owner',
            );
        });

        it('should reject when trying to register with output type 0', async () => {
            await expectRevert(
                this.registry.registerOutputGuardHandler(0, this.dummyOutputGuardHandler.address),
                'Should not register with output type 0',
            );
        });

        it('should reject when trying to register with an empty address', async () => {
            await expectRevert(
                this.registry.registerOutputGuardHandler(1, constants.ZERO_ADDRESS),
                'Should not register an empty address',
            );
        });

        it('should reject when the output type is already registered', async () => {
            const outputType = 1;
            const secondDummyHandler = (await ExpectedOutputGuardHandler.new(true, constants.ZERO_ADDRESS));
            await this.registry.registerOutputGuardHandler(outputType, this.dummyOutputGuardHandler.address);
            await expectRevert(
                this.registry.registerOutputGuardHandler(outputType, secondDummyHandler.address),
                'The output type has already been registered',
            );
        });
    });
});
