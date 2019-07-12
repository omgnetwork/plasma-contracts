const OutputGuardParserRegistry = artifacts.require('OutputGuardParserRegistry');
const DummyOutputGuardParser = artifacts.require('DummyOutputGuardParser');

const { constants, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('OutputGuardParserRegistry', ([_, other]) => {
    beforeEach(async () => {
        this.dummyOutputGuardParser = await DummyOutputGuardParser.new(constants.ZERO_ADDRESS);
        this.registry = await OutputGuardParserRegistry.new();
    });

    describe('outputGuardParsers', () => {
        it('should receive empty outputGuardParser contract address when output type not registered', async () => {
            const nonRegisteredOutputType = 66666;
            expect(await this.registry.outputGuardParsers(nonRegisteredOutputType)).to.equal(constants.ZERO_ADDRESS);
        });
    });

    describe('registerOutputGuardParser', () => {
        it('should be able to register successfully', async () => {
            const outputType = 1;
            await this.registry.registerOutputGuardParser(outputType, this.dummyOutputGuardParser.address);
            expect(await this.registry.outputGuardParsers(outputType)).to.equal(this.dummyOutputGuardParser.address);
        });

        it('should reject when not registered by operator', async () => {
            await expectRevert(
                this.registry.registerOutputGuardParser(1, this.dummyOutputGuardParser.address, { from: other }),
                'Not being called by operator',
            );
        });

        it('should reject when frozen', async () => {
            await this.registry.freeze();
            await expectRevert(
                this.registry.registerOutputGuardParser(1, this.dummyOutputGuardParser.address),
                'The function has been frozen',
            );
        });

        it('should reject when trying to register with output type 0', async () => {
            await expectRevert(
                this.registry.registerOutputGuardParser(0, this.dummyOutputGuardParser.address),
                'Should not register with output type 0',
            );
        });

        it('should reject when trying to register with an empty address', async () => {
            await expectRevert(
                this.registry.registerOutputGuardParser(1, constants.ZERO_ADDRESS),
                'Should not register an empty address',
            );
        });

        it('should reject when the output type is already registered', async () => {
            const outputType = 1;
            const secondDummyParserAddress = (await DummyOutputGuardParser.new(constants.ZERO_ADDRESS)).address;
            await this.registry.registerOutputGuardParser(outputType, this.dummyOutputGuardParser.address);
            await expectRevert(
                this.registry.registerOutputGuardParser(outputType, secondDummyParserAddress),
                'The output type has already been registered',
            );
        });
    });
});
