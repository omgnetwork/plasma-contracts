const ExitId = artifacts.require('ExitIdWrapper');

const { expect } = require('chai');

contract('ExitId', () => {
    before('setup', async () => {
        this.contract = await ExitId.new();
    });

    describe('isStandardExit', () => {
        it('should return true given a standard exit id for deposit tx', async () => {
            const isDeposit = true;
            const dummyTxBytes = `0x${Array(100).fill(1).join('')}`;
            const dummyUtxoPos = 1000000000;

            const exitId = await this.contract.getStandardExitId(isDeposit, dummyTxBytes, dummyUtxoPos);
            expect(await this.contract.isStandardExit(exitId)).to.be.true;
        });

        it('should return true given a standard exit id for non deposit tx', async () => {
            const isDeposit = false;
            const dummyTxBytes = `0x${Array(100).fill(1).join('')}`;
            const dummyUtxoPos = 1000000000;

            const exitId = await this.contract.getStandardExitId(isDeposit, dummyTxBytes, dummyUtxoPos);
            expect(await this.contract.isStandardExit(exitId)).to.be.true;
        });

        it('should return false given an in-flight exit id', async () => {
            const dummyTxBytes = `0x${Array(100).fill(1).join('')}`;
            const exitId = await this.contract.getInFlightExitId(dummyTxBytes);
            expect(await this.contract.isStandardExit(exitId)).to.be.false;
        });
    });
});
