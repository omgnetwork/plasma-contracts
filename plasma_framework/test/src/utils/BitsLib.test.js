const BitsWrapper = artifacts.require('BitsWrapper');

const { BN } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('Bits', () => {
    const MAX_INDEX = 255;
    // check all 0-255 takes too mush time for test
    const indices = [255, 127, 63, 31, 15, 7, 3, 1, 0];

    before('setup', async () => {
        this.contract = await BitsWrapper.new();
    });

    describe('bit operations', () => {
        it('should set bit on specified position', async () => {
            const promises = indices.map(i => this.contract.setBit(0, i));
            const results = await Promise.all(promises);

            results.every((actual, i) => {
                const padZero = indices[i] + 1;
                const expected = new BN('1'.padEnd(padZero, '0'), 2);

                return expect(actual.eq(expected)).to.be.true;
            });
        });

        it('should set bit - small numbers', async () => {
            const n = new BN('10000001', 2);

            let m = await this.contract.setBit(n, 1);
            expect(m.eq(new BN('10000011', 2))).to.be.true;

            m = await this.contract.setBit(m, 2);
            expect(m.eq(new BN('10000111', 2))).to.be.true;

            m = await this.contract.setBit(m, 6);
            expect(m.eq(new BN('11000111', 2))).to.be.true;

            m = await this.contract.setBit(m, 4);
            expect(m.eq(new BN('11010111', 2))).to.be.true;
        });

        it('setting already set bit does not change the value', async () => {
            const num = new BN('1001001', 2);
            expect((await this.contract.setBit(num, 3))
                .eq(num)).to.be.true;
        });

        it('should clear bit on specified position', async () => {
            const replaceAt = (str, index, replacement) => (
                str.substr(0, index) + replacement + str.substr(index + replacement.length)
            );

            const longStr = ''.padEnd(MAX_INDEX + 1, '1');
            const hugeNum = new BN(longStr, 2);

            const promises = indices.map(i => this.contract.clearBit(hugeNum, i));
            const results = await Promise.all(promises);

            results.every((actual, i) => {
                const zeroPos = MAX_INDEX - indices[i];
                const expected = new BN(replaceAt(longStr, zeroPos, '0'), 2);

                return expect(actual.eq(expected)).to.be.true;
            });
        });

        it('should clear bit - small numbers', async () => {
            const n = new BN('11111111', 2);

            let m = await this.contract.clearBit(n, 1);
            expect(m.eq(new BN('11111101', 2))).to.be.true;

            m = await this.contract.clearBit(m, 3);
            expect(m.eq(new BN('11110101', 2))).to.be.true;

            m = await this.contract.clearBit(m, 5);
            expect(m.eq(new BN('11010101', 2))).to.be.true;

            m = await this.contract.clearBit(m, 0);
            expect(m.eq(new BN('11010100', 2))).to.be.true;
        });

        it('clearing already cleared bit does not change the value', async () => {
            const num = new BN('1110111', 2);
            expect((await this.contract.clearBit(num, 3))
                .eq(num)).to.be.true;
        });

        it('should answer whether bit is set', async () => {
            const onesAndZeros = [...Array((MAX_INDEX + 1) / 2).keys()]
                .map(_i => '10')
                .join('');
            const largeNum = new BN(onesAndZeros, 2);

            // note: flatMap available in nodejs from 11.x
            const promises = indices
                .filter(i => i > 0)
                .reduce((acc, i) => acc.concat([
                    this.contract.bitSet(largeNum, i),
                    this.contract.bitSet(largeNum, i - 1),
                ]), []);
            const results = await Promise.all(promises);

            results.reduce((expected, val) => {
                expect(val).to.equal(expected);
                return !expected;
            }, true);
        });
    });
});
