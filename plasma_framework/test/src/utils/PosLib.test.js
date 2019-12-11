const PosLib = artifacts.require('PosLibWrapper');

const { BN, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('PosLib', () => {
    const TX_OFFSET = 10000;

    before('setup contract and utxo pos values', async () => {
        this.contract = await PosLib.new();

        this.blockNumber = 314159;
        this.txIndex = 123;
        this.outputIndex = 2;

        this.position = {
            blockNum: this.blockNumber,
            txIndex: this.txIndex,
            outputIndex: this.outputIndex,
        };

        const BLOCK_OFFSET = 1000000000;
        this.utxoPos = this.blockNumber * BLOCK_OFFSET + this.txIndex * TX_OFFSET + this.outputIndex;
        this.txPos = this.utxoPos - this.outputIndex;
    });

    describe('buildPositionFromTxPosAndOutputIndex', () => {
        it('should build the correct position from txPos and outputIndex', async () => {
            const result = await this.contract.buildPositionFromTxPosAndOutputIndex(this.txPos, this.outputIndex);
            expect(new BN(result.blockNumber)).to.be.bignumber.equal(new BN(this.blockNum));
            expect(new BN(result.txIndex)).to.be.bignumber.equal(new BN(this.txIndex));
            expect(new BN(result.outputIndex)).to.be.bignumber.equal(new BN(this.outputIndex));
        });

        it('should revert when tx pos is not a position of zero index output', async () => {
            const txPos = this.txPos + 1;
            await expectRevert(this.contract.buildPositionFromTxPosAndOutputIndex(txPos, this.outputIndex), 'Invalid transaction position');
        });
    });

    describe('txPos', () => {
        it('should parse a correct tx position', async () => {
            const txPos = await this.contract.txPos(this.position);
            expect(new BN(txPos.blockNumber)).to.be.bignumber.equal(new BN(this.blockNum));
            expect(new BN(txPos.txIndex)).to.be.bignumber.equal(new BN(this.txIndex));
            expect(new BN(txPos.outputIndex)).to.be.bignumber.equal(new BN(0));
        });
    });

    describe('getTxPostionForExitPriority', () => {
        it('should get a correct tx position for exit priority', async () => {
            const result = await this.contract.getTxPostionForExitPriority(this.position);
            const expected = this.utxoPos / TX_OFFSET;
            expect(result).to.be.bignumber.equal(new BN(expected));
        });
    });

    describe('encode', () => {
        it('should correctly encode a position', async () => {
            const result = await this.contract.encode(this.position);
            expect(result).to.be.bignumber.equal(new BN(this.utxoPos));
        });
    });

    describe('encodePackedTxPos', () => {
        it('should encode a tx position', async () => {
            const txPos = {
                blockNum: this.blockNumber,
                txIndex: this.txIndex,
                outputIndex: 0,
            };
            const result = await this.contract.encodePackedTxPos(txPos);
            expect(result).to.be.bignumber.equal(new BN(this.txPos));
        });

        it('should fail when invalid position is provided as argument', async () => {
            await expectRevert(
                this.contract.encodePackedTxPos(this.position),
                'Invalid transaction position',
            );
        });
    });

    describe('decode', () => {
        it('should decode a position', async () => {
            const result = await this.contract.decode(this.utxoPos);
            expect(new BN(result.blockNumber)).to.be.bignumber.equal(new BN(this.blockNum));
            expect(new BN(result.txIndex)).to.be.bignumber.equal(new BN(this.txIndex));
            expect(new BN(result.outputIndex)).to.be.bignumber.equal(new BN(this.outputIndex));
        });
    });
});
