const RLPMock = artifacts.require('RLPMock');
const { expectRevert } = require('openzeppelin-test-helpers');
const tests = require('./fixture/invalidRLPTest.json');

const STRING_SHORT_START = 0x80;
const STRING_LONG_START = 0xb8;
const LIST_SHORT_START = 0xc0;
const LIST_LONG_START = 0xf8;

// Using test fixtures from https://github.com/ethereum/tests/blob/develop/RLPTests/invalidRLPTest.json
contract('RLP invalid tests', () => {
    before(async () => {
        this.rlp = await RLPMock.new();
    });

    Object.keys(tests).forEach((testName) => {
        it(`should revert on invalid test ${testName}`, async () => {
            const encoded = tests[testName].out;

            if (testName.includes('stringListInvalidEncodedLength')) {
                await expectRevert(this.rlp.decodeList(encoded), 'Decoded RLP length for list is invalid');
            } else if (testName.includes('stringListInvalidEncodedItemLength')) {
                await expectRevert(this.rlp.decodeList(encoded), 'Invalid decoded length of RLP item found during counting items in a list');
            } else if (testName.includes('shortStringInvalidEncodedLength')) {
                await expectRevert(this.rlp.decodeUint(encoded), 'Decoded length is greater than input data');
            } else if (testName.includes('wrongEmptyString')) {
                await expectRevert(this.rlp.decodeUint(encoded), 'Item length must be between 1 and 33 bytes');
                await expectRevert(this.rlp.decodeList(encoded), 'Item is not a list');
            } else if (testName.includes('invalidAddress')) {
                await expectRevert(this.rlp.decodeBytes20(encoded), 'Item length must be 21');
            } else if (testName.includes('invalidList')) {
                await expectRevert(this.rlp.decodeList(encoded), 'Item is not a list');
            } else if (testName.includes('wrongSizeList')) {
                await expectRevert(this.rlp.decodeList(encoded), 'Invalid RLP encoding');
            } else if (testName.includes('bytesShouldBeSingleByte')) {
                await expectRevert(this.rlp.decodeUint(encoded), 'Invalid RLP encoding');
            } else if (testName.includes('leadingZerosInLongLengthArray2')) {
                await expectRevert(this.rlp.decodeBytes32(encoded), 'Invalid RLP encoding');
            } else if (testName.includes('leadingZerosInLongLengthList')) {
                await expectRevert(this.rlp.decodeList(encoded), 'Invalid RLP encoding');
            } else if (testName.includes('nonOptimalLongLengthList')) {
                await expectRevert(this.rlp.decodeList(encoded), 'Invalid RLP encoding');
            } else if (testName.includes('nonOptimalLongLengthArray')) {
                await expectRevert(this.rlp.decodeString(encoded), 'Invalid RLP encoding');
            } else if (testName.includes('longstringInvalidEncodedLength')) {
                await expectRevert(this.rlp.decodePayloadOffset(encoded), 'Decoded RLPItem payload length is invalid');
            } else if (testName.includes('UInt')) {
                await expectRevert(this.rlp.decodeUint(encoded), 'Leading zeros are invalid');
            }
        });
    });
});
