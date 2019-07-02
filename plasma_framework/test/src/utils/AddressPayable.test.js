const AddressPayable = artifacts.require('AddressPayableWrapper');

const { constants } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

/**
 * Test cases credit to open zepplin:
 * https://github.com/OpenZeppelin/openzeppelin-solidity/blob/master/test/utils/Address.test.js#L25
 *
 * They have the same functionality code but does not release that function in the library.
 */
contract('AddressPayable', ([arbitraryAddress]) => {
    before('setup', async () => {
        this.contract = await AddressPayable.new();
    });

    describe('convert', () => {
        const ALL_ONES_ADDRESS = '0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF';

        it('should return a payable address when the account is the zero address', async () => {
            expect(await this.contract.convert(constants.ZERO_ADDRESS)).to.equal(constants.ZERO_ADDRESS);
        });

        it('should return a payable address when the account is an arbitrary address', async () => {
            expect(await this.contract.convert(arbitraryAddress)).to.equal(arbitraryAddress);
        });

        it('should return a payable address when the account is the all ones address', async () => {
            expect(await this.contract.convert(ALL_ONES_ADDRESS)).to.equal(ALL_ONES_ADDRESS);
        });
    });
});
