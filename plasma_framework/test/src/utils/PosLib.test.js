const PosLib = artifacts.require('PosLibWrapper');

const { BN, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('PosLib', () => {
    const BLOCK_OFFSET = 1000000000;
    const TX_OFFSET = 10000;

    const maxOutputIndex = new BN(TX_OFFSET - 1);
    const maxTxIndex = (new BN(2)).pow(new BN(16)).sub(new BN(1));
    const maxBlockNum = (new BN(2)).pow(new BN(56)).sub(new BN(1))
        .sub(maxTxIndex)
        .div(new BN(BLOCK_OFFSET / TX_OFFSET));

    before('setup contract and utxo pos values', async () => {
        this.contract = await PosLib.new();

        this.blockNum = 314159;
        this.txIndex = 123;
        this.outputIndex = 2;

        this.position = {
            blockNum: this.blockNum,
            txIndex: this.txIndex,
            outputIndex: this.outputIndex,
        };

        this.utxoPos = this.blockNum * BLOCK_OFFSET + this.txIndex * TX_OFFSET + this.outputIndex;
        this.txPos = this.utxoPos - this.outputIndex;
    });

    describe('toStrictTxPos', () => {
        it('should parse a correct tx position', async () => {
            const txPos = await this.contract.toStrictTxPos(this.position);
            expect(new BN(txPos.blockNum)).to.be.bignumber.equal(new BN(this.blockNum));
            expect(new BN(txPos.txIndex)).to.be.bignumber.equal(new BN(this.txIndex));
            expect(new BN(txPos.outputIndex)).to.be.bignumber.equal(new BN(0));
        });
    });

    describe('getTxPositionForExitPriority', () => {
        it('should get a correct tx position for exit priority', async () => {
            const result = await this.contract.getTxPositionForExitPriority(this.position);
            const expected = this.utxoPos / TX_OFFSET;
            expect(result).to.be.bignumber.equal(new BN(expected));
        });
    });

    describe('encode', () => {
        describe('should correctly encode', () => {
            const outputIndexes = [new BN(0), new BN(this.outputIndex), maxOutputIndex];
            const txIndexes = [new BN(0), new BN(this.txIndex), maxTxIndex];
            const blockNums = [new BN(0), new BN(this.blockNum), maxBlockNum];

            blockNums.forEach((blockNum) => {
                txIndexes.forEach((txIndex) => {
                    outputIndexes.forEach((outputIndex) => {
                        it(`with blockNum: ${blockNum}, txIndex: ${txIndex}, outputIndex: ${outputIndex}`, async () => {
                            const position = {
                                blockNum: blockNum.toString(),
                                txIndex: txIndex.toString(),
                                outputIndex: outputIndex.toString(),
                            };
                            const encodedPosition = blockNum.mul(new BN(BLOCK_OFFSET))
                                .add(txIndex.mul(new BN(TX_OFFSET)))
                                .add(outputIndex);
                            const result = await this.contract.encode(position);
                            expect(result).to.be.bignumber.equal(encodedPosition);
                        });
                    });
                });
            });
        });

        it('should fail when output index is too big', async () => {
            const position = {
                blockNum: this.blockNum,
                txIndex: this.txIndex,
                outputIndex: TX_OFFSET,
            };
            await expectRevert(
                this.contract.encode(position),
                'Invalid output index',
            );
        });

        it('should fail when block number is too big', async () => {
            const invalidBlockNum = maxBlockNum.add(new BN(1)).toString();
            const position = {
                blockNum: invalidBlockNum,
                txIndex: this.txIndex,
                outputIndex: this.outputIndex,
            };
            await expectRevert(
                this.contract.encode(position),
                'Invalid block number',
            );
        });
    });

    describe('decode', () => {
        describe('should decode a position', () => {
            const outputIndexes = [new BN(0), new BN(this.outputIndex), maxOutputIndex];
            const txIndexes = [new BN(0), new BN(this.txIndex), maxTxIndex];
            const blockNums = [new BN(0), new BN(this.blockNum), maxBlockNum];

            blockNums.forEach((blockNum) => {
                txIndexes.forEach((txIndex) => {
                    outputIndexes.forEach((outputIndex) => {
                        it(`with blockNum: ${blockNum}, txIndex: ${txIndex}, outputIndex: ${outputIndex}`, async () => {
                            const position = blockNum.mul(new BN(BLOCK_OFFSET))
                                .add(txIndex.mul(new BN(TX_OFFSET)))
                                .add(outputIndex)
                                .toString();
                            const result = await this.contract.decode(position);
                            expect(new BN(result.blockNum)).to.be.bignumber.equal(blockNum);
                            expect(new BN(result.txIndex)).to.be.bignumber.equal(txIndex);
                            expect(new BN(result.outputIndex)).to.be.bignumber.equal(outputIndex);
                        });
                    });
                });
            });
        });

        it('should fail when transaction index exceeds uint16 limit', async () => {
            const txIndexTooLarge = 2 ** 16;
            const position = this.blockNum * BLOCK_OFFSET + txIndexTooLarge * TX_OFFSET + this.outputIndex;
            await expectRevert(
                this.contract.decode(position),
                'txIndex exceeds the size of uint16',
            );
        });

        it('should fail when block number exceeds max size allowed in PlasmaFramework', async () => {
            const position = (maxBlockNum.add(new BN(1))).mul(new BN(BLOCK_OFFSET)).toString();
            await expectRevert(
                this.contract.decode(position),
                'blockNum exceeds max size allowed in PlasmaFramework',
            );
        });
    });
});
