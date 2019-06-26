const rlp = require('rlp');

const RLPMock = artifacts.require("RLPMock");

contract("RLP", () => {

    before(async () => {
        this.test = await RLPMock.new();
    });

    it("should decode bytes32", async () => {
        const expected = Buffer.alloc(32, 1);

        const encoded = web3.utils.bytesToHex(rlp.encode(expected));
        const actual = Buffer.from(
            web3.utils.hexToBytes(await this.test.decodeBytes32(encoded))
        );
        expect(actual.compare(expected)).to.equal(0);
    });

    it("should decode false boolean", async () => {
        const bool = web3.utils.bytesToHex(rlp.encode(new Buffer([0x00])));
        expect(await this.test.decodeBool(bool)).is.false;
    });

    it("should decode true boolean", async () => {
        const bool = web3.utils.bytesToHex(rlp.encode(new Buffer([0x01])));
        expect(await this.test.decodeBool(bool)).is.true;
    });

    it("should decode uint 0", async () => {
        await testNumberDecoded(this.test.decodeUint, 0);
    });

    it("should decode positive uint", async () => {
        await testNumberDecoded(this.test.decodeUint, 100);
    });

    it("should decode int 0", async () => {
        await testNumberDecoded(this.test.decodeInt, 0);
    });

    it("should decode positive int", async () => {
        await testNumberDecoded(this.test.decodeInt, 100);
    });

    async function testNumberDecoded(callback, expected) {
        const encoded = web3.utils.bytesToHex(rlp.encode(expected));
        const actual = (await callback(encoded)).toNumber();
        expect(actual).is.equal(expected);
    }

    it("should decode array", async () => {
        const array = [[Buffer.alloc(32, 1)]]
        const encoded = web3.utils.bytesToHex(rlp.encode(array));
        const arrayLength = (await this.test.decodeArray(encoded)).toNumber();
        expect(arrayLength).is.equal(array.length);
    });

})
