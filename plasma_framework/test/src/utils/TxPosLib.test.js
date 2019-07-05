const TxPosLib = artifacts.require('TxPosLibWrapper');

const { BN } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('TxPosLib', () => {
    before('setup lib and tx pos values', async () => {
        this.contract = await TxPosLib.new();

        this.blockNumber = 314159;
        this.txIndex = 123;

        const BLOCK_OFFSET_OF_TX_POS = 1000000000 / 10000;
        this.txPos = this.blockNumber * BLOCK_OFFSET_OF_TX_POS + this.txIndex;
    });

    describe('blockNum', () => {
        it('should parse the correct block number', async () => {
            expect(await this.contract.blockNum(this.txPos))
                .to.be.bignumber.equal(new BN(this.blockNumber));
        });
    });

    describe('txIndex', () => {
        it('should parse the correct tx index', async () => {
            expect(await this.contract.txIndex(this.txPos))
                .to.be.bignumber.equal(new BN(this.txIndex));
        });
    });
});
