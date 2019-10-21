const rlp = require('rlp');
const { expect } = require('chai');

const RLPMock = artifacts.require('RLPMock');

contract('RLP', () => {
    before(async () => {
        this.test = await RLPMock.new();
    });

    it('should decode bytes32', async () => {
        const expected = Buffer.alloc(32, 1);

        const encoded = web3.utils.bytesToHex(rlp.encode(expected));
        const actual = Buffer.from(
            web3.utils.hexToBytes(await this.test.decodeBytes32(encoded)),
        );
        expect(actual.compare(expected)).to.equal(0);
    });

    it('should decode bytes20', async () => {
        const expected = Buffer.alloc(20, 1);

        const encoded = web3.utils.bytesToHex(rlp.encode(expected));
        const actual = Buffer.from(
            web3.utils.hexToBytes(await this.test.decodeBytes20(encoded)),
        );
        expect(actual.compare(expected)).to.equal(0);
    });

    it('should decode uint 0', async () => {
        await testNumberDecoded(this.test.decodeUint, 0);
    });

    it('should decode positive uint', async () => {
        await testNumberDecoded(this.test.decodeUint, 100);
    });

    it('should decode int 0', async () => {
        await testNumberDecoded(this.test.decodeInt, 0);
    });

    it('should decode positive int', async () => {
        await testNumberDecoded(this.test.decodeInt, 100);
    });

    async function testNumberDecoded(callback, expected) {
        const encoded = web3.utils.bytesToHex(rlp.encode(expected));
        const actual = (await callback(encoded)).toNumber();
        expect(actual).is.equal(expected);
    }

    it('should decode array', async () => {
        const array = [[Buffer.alloc(32, 1)]];
        const encoded = web3.utils.bytesToHex(rlp.encode(array));
        const decoded = await this.test.decodeList(encoded);
        expect(decoded.length).is.equal(array.length);
    });
});
