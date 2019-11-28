const rlp = require('rlp');
const { expect } = require('chai');
const { expectRevert } = require('openzeppelin-test-helpers');

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

    it('should fail decode to a bytes32 that has less than 32 bytes', async () => {
        const expected = Buffer.alloc(31, 1);
        const encoded = web3.utils.bytesToHex(rlp.encode(expected));
        await expectRevert(this.test.decodeBytes32(encoded), 'Item length must be 33');
    });

    it('should decode bytes20', async () => {
        const expected = Buffer.alloc(20, 1);

        const encoded = web3.utils.bytesToHex(rlp.encode(expected));
        const actual = Buffer.from(
            web3.utils.hexToBytes(await this.test.decodeBytes20(encoded)),
        );
        expect(actual.compare(expected)).to.equal(0);
    });

    it('should not decode an invalid length address', async () => {
        const invalid21byteAddress = '0xCA35b7d915458EF540aDe6068dFe2F44E8fa733c00';
        const encoded = web3.utils.bytesToHex(rlp.encode(invalid21byteAddress));
        await expectRevert(this.test.decodeBytes20(encoded), 'Item length must be 21');
    });

    it('should not decode an invalid length address', async () => {
        const invalidLengthInEncodedAddress = '0x950000000000000000000000000000000000000000';
        await expectRevert(this.test.decodeBytes20(invalidLengthInEncodedAddress), 'Decoded item length must be 21');
    });

    it('should not decode an invalid length bytes32', async () => {
        const invalidLengthInEncodedBytes32 = '0xa10000000000000000000000000000000000000000000000000000000000000000';
        await expectRevert(this.test.decodeBytes32(invalidLengthInEncodedBytes32), 'Decoded item length must be 33');
    });

    it('should decode uint 0', async () => {
        await testNumberDecoded(this.test.decodeUint, 0);
    });

    it('should decode uint 0', async () => {
        await testNumberDecoded(this.test.decodeUint, 0);
    });

    it('should decode positive uint', async () => {
        await testNumberDecoded(this.test.decodeUint, 100);
    });

    it('should fail to decode 0x00 as a uint', async () => {
        const encoded = '0x00';
        await expectRevert(this.test.decodeUint(encoded), 'Scalar 0 should be encoded as 0x80');
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
