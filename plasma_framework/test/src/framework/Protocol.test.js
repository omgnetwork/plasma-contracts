const Protocol = artifacts.require('ProtocolWrapper');

const { BN } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { PROTOCOL } = require('../../helpers/constants.js');

contract('Protocol', () => {
    before(async () => {
        this.test = await Protocol.new();
    });

    describe('MORE_VP()', () => {
        it('should return protocol value of MoreVP', async () => {
            expect(await this.test.MORE_VP()).to.be.bignumber.equal(new BN(PROTOCOL.MORE_VP));
        });
    });

    describe('MVP()', () => {
        it('should return protocol value of MVP', async () => {
            expect(await this.test.MVP()).to.be.bignumber.equal(new BN(PROTOCOL.MVP));
        });
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
