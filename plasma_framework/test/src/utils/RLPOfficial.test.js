const RLPMock = artifacts.require('RLPMock');
const { BN } = require('openzeppelin-test-helpers');
const { expect } = require('chai');
const { tests } = require('./fixture/rlptest.json');

// Using test fixtures from https://github.com/ethereum/tests/blob/develop/RLPTests/rlptest.json
contract('RLP official tests', () => {
    const decode = async (encoded, expected) => {
        if (Number.isInteger(expected)) {
            const decoded = await this.rlp.decodeUint(encoded);
            expect(decoded).to.bignumber.equal(new BN(expected));
        } else if (Array.isArray(expected)) {
            const decoded = await this.rlp.decodeList(encoded);
            expect(Array.isArray(decoded)).to.be.true;
            return Promise.all(decoded.map((elem, i) => decode(elem, expected[i])));
        } else if (typeof expected === 'string' || expected instanceof String) {
            if (expected[0] === '#') {
                // We are testing a big number
                const bignum = new BN(expected.slice(1));
                const decodedUint = await this.rlp.decodeUint(encoded);
                expect(decodedUint).to.bignumber.equal(bignum);
            } else {
                const decoded = await this.rlp.decodeString(encoded);
                expect(decoded).to.equal(expected);
            }
        } else {
            expect.fail(`input ${expected} is an unknown type`);
        }
        return true;
    };

    before(async () => {
        this.rlp = await RLPMock.new();
    });

    Object.keys(tests).forEach((testName) => {
        it(`should pass ${testName}`, async () => {
            const original = tests[testName].in;
            const encoded = tests[testName].out;

            if (testName === 'bigint') {
                // Special test that encodes a number bigger than max uint256 so it has to be decoded as bytes.
                const expected = new BN(original.slice(1));
                const decodedBytes = await this.rlp.decodeBytes(encoded);
                return expect(new BN(Buffer.from(decodedBytes.replace('0x', ''), 'hex'))).to.bignumber.equal(expected);
            }

            return decode(encoded, original);
        });
    });
});
