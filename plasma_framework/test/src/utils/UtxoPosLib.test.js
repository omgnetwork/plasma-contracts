const UtxoPosLib = artifacts.require('UtxoPosLibWrapper');

const { BN } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('UtxoPosLib', () => {
    before('setup contract and utxo pos values', async () => {
        this.contract = await UtxoPosLib.new();

        this.blockNumber = 314159;
        this.txIndex = 123;
        this.outputIndex = 2;

        const BLOCK_OFFSET = 1000000000;
        const TX_OFFSET = 10000;
        this.utxoPos = this.blockNumber * BLOCK_OFFSET + this.txIndex * TX_OFFSET + this.outputIndex;
        this.txPos = Math.floor(this.utxoPos / TX_OFFSET);
    });

    describe('build', () => {
        it('should build the correct utxoPos from txPos and outputIndex', async () => {
            const result = await this.contract.build(this.txPos, this.outputIndex);
            expect(new BN(result.value)).to.be.bignumber.equal(new BN(this.utxoPos));
        });
    });

    describe('blockNum', () => {
        it('should parse the correct block number', async () => {
            expect(await this.contract.blockNum(this.utxoPos))
                .to.be.bignumber.equal(new BN(this.blockNumber));
        });
    });

    describe('txIndex', () => {
        it('should parse the correct tx index', async () => {
            expect(await this.contract.txIndex(this.utxoPos))
                .to.be.bignumber.equal(new BN(this.txIndex));
        });
    });

    describe('outputIndex', () => {
        it('should parse the correct output index', async () => {
            expect(await this.contract.outputIndex(this.utxoPos))
                .to.be.bignumber.equal(new BN(this.outputIndex));
        });
    });

    describe('txPos', () => {
        it('should parse the correct tx position', async () => {
            const txPos = await this.contract.txPos(this.utxoPos);
            expect(new BN(txPos.value)).to.be.bignumber.equal(new BN(this.txPos));
        });
    });
});
