const RLPMock = artifacts.require('RLPMock');
const { BN, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');
const tests = require('./fixture/invalidRLPTest.json');
const rlp = require('rlp');

// Using test fixtures from https://github.com/ethereum/tests/blob/develop/RLPTests/invalidRLPTest.json
contract.only('RLP invalid tests', () => {
    before(async () => {
        this.rlp = await RLPMock.new();
    });

    Object.keys(tests).forEach((testName) => {
        it(`should revert on invalid test ${testName}`, async () => {
            const encoded = tests[testName].out;

            // if (testName.includes('int32')) {
            //     // const e = rlp.decode(encoded);
            //     await expectRevert.unspecified(
            //         this.rlp.decodeIntStrict(encoded),
            //     );
            // } else if (testName.includes('List') || testName.includes('Array')) {
            //     await expectRevert.unspecified(
            //         this.rlp.decodeList(encoded),
            //     );
            // } else
            if (testName.includes('incorrectLengthInArray')) {
                // const ret = await this.rlp.decodeByte(encoded);
                // console.log(ret.toString());
                await expectRevert.unspecified(
                    this.rlp.decodeList(encoded),
                );
            } else {
                expect.fail('unknown test type');
            }
        });
    });
});
