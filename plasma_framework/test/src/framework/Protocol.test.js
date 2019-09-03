const Protocol = artifacts.require('ProtocolWrapper');

const { expect } = require('chai');

const { PROTOCOL } = require('../../helpers/constants.js');

contract('Protocol', () => {
    before(async () => {
        this.test = await Protocol.new();
    });

    describe('isValidProtocol', () => {
        it('should return true for MVP protocol', async () => {
            expect(await this.test.isValidProtocol(PROTOCOL.MVP)).to.be.true;
        });

        it('should return true for MoreVP protocol', async () => {
            expect(await this.test.isValidProtocol(PROTOCOL.MORE_VP)).to.be.true;
        });

        it('should return false for invalid protocol', async () => {
            const invalidProtocolValues = [0, 3, 255];
            await Promise.all(invalidProtocolValues.map(async (protocol) => {
                expect(await this.test.isValidProtocol(protocol)).to.be.false;
            }));
        });
    });
});
