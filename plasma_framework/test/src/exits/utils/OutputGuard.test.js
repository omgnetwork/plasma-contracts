const OutputGuard = artifacts.require('OutputGuardWrapper');

const { expect } = require('chai');
const { buildOutputGuard } = require('../../../helpers/utils.js');

contract('OutputGuard', () => {
    const EMPTY_OUTPUT_GUARD = `0x${Array(64).fill(1).join('')}`;

    before('setup', async () => {
        this.contract = await OutputGuard.new();
    });

    describe('build', () => {
        it('should get the correct output guard given output type 0 and empty output guard data', async () => {
            const outputType = 0;
            const result = await this.contract.build(outputType, EMPTY_OUTPUT_GUARD);
            expect(web3.utils.toHex(result))
                .to.equal(buildOutputGuard(outputType, EMPTY_OUTPUT_GUARD));
        });

        it('should get the correct output guard given output type non 0 and empty output guard data', async () => {
            const outputType = 1;

            expect(await this.contract.build(outputType, EMPTY_OUTPUT_GUARD))
                .to.equal(buildOutputGuard(outputType, EMPTY_OUTPUT_GUARD));
        });

        it('should get the correct output guard given output type non 0 and non empty output guard data', async () => {
            const outputType = 1;
            const outputGuardData = web3.utils.utf8ToHex('output guard data');

            expect(await this.contract.build(outputType, outputGuardData))
                .to.equal(buildOutputGuard(outputType, outputGuardData));
        });
    });
});
