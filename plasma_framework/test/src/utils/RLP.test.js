const rlp = require('rlp');

const RLPMock = artifacts.require("RLPMock");

contract("RLP", () => {

    before(async () => {
        this.test = await RLPMock.new();
    });

    it("should decode bytes", async () => {
        const expected = "bytes";

        const encoded = await rlp.encode(expected);
        expect(rlp.decode(encoded).toString()).to.equal(expected);

        const actual = await this.test.decodeBytes(encoded, encoded); //FIXME: What's withthis double
        expect(actual).to.equal(expected);
    });

    it("should decode bytes32", async () => {
        const expected = "1234567890abcdefghijklmnopqrstuw";

        const encoded = await rlp.encode(expected);
        const actual = web3.utils.toAscii(await this.test.decodeBytes32(encoded, encoded)); //FIXME: What's withthis double

        expect(actual).to.have.lengthOf(32);
        expect(actual).to.equal(expected);
    });

    it("should decode bool", async () => {
        let bool = rlp.encode(new Buffer([0x00])); // false
        expect(await this.test.decodeBool(bool, bool)).is.false;

        bool = rlp.encode(new Buffer([0x01])); // true;
        expect(await this.test.decodeBool(bool, bool)).is.true;
    });

    it("should decode uint", async () => {
        await testNumberDecoded(this.test.decodeUint, 0);
        await testNumberDecoded(this.test.decodeUint, 100);
    });

    it("should decode int", async () => {
        await testNumberDecoded(this.test.decodeInt, 0);
        await testNumberDecoded(this.test.decodeInt, 100);
    });

    async function testNumberDecoded(callback, expected) {
      const encoded = rlp.encode(expected);
      const actual = (await callback(encoded, encoded)).toNumber();
      expect(actual).is.equal(expected);
    }

    it("should decode array", async () => {
        const array = ["a", 1, new Buffer([0x00, 0x01])]
        const encoded = await rlp.encode(array);
        const arrayLength = (await this.test.decodeArray(encoded, encoded)).toNumber();
        expect(arrayLength).is.equal(array.length);
    });
})
