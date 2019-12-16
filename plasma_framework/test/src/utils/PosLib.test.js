const PosLib = artifacts.require('PosLibWrapper');

const { BN, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('PosLib', () => {
    const BLOCK_OFFSET = 1000000000;
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

        this.utxoPos = this.blockNumber * BLOCK_OFFSET + this.txIndex * TX_OFFSET + this.outputIndex;
        this.txPos = this.utxoPos - this.outputIndex;
    });

    describe('toStrictTxPos', () => {
        it('should parse a correct tx position', async () => {
            const txPos = await this.contract.toStrictTxPos(this.position);
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

        it('should fail when output index is too big', async () => {
            const position = {
                blockNum: this.blockNumber,
                txIndex: this.txIndex,
                outputIndex: 1000000,
            };
            await expectRevert(
                this.contract.encode(position),
                'Invalid output index',
            );
        });

        it('should fail when transaction index is too big', async () => {
            const position = {
                blockNum: this.blockNumber,
                txIndex: BLOCK_OFFSET,
                outputIndex: this.outputIndex,
            };
            await expectRevert(
                this.contract.encode(position),
                'Invalid transaction index',
            );
        });

        it('should fail when block number is too big', async () => {
            const invalidBlockNum = '0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
            const position = {
                blockNum: invalidBlockNum,
                txIndex: this.txIndex,
                outputIndex: this.outputIndex,
            };
            await expectRevert(
                this.contract.encode(position),
                'SafeMath: ',
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
