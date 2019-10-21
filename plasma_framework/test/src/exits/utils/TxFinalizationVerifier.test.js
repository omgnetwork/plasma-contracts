const TxFinalizationVerifier = artifacts.require('TxFinalizationVerifier');
const PlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');

const { expect } = require('chai');
const { constants, expectRevert } = require('openzeppelin-test-helpers');

const { buildTxPos } = require('../../../helpers/positions.js');
const { MerkleTree } = require('../../../helpers/merkle.js');
const { sign } = require('../../../helpers/sign.js');
const { PROTOCOL, EMPTY_BYTES } = require('../../../helpers/constants.js');

contract('TxFinalizationVerifier', ([richFather]) => {
    const TEST_BLOCK_NUM = 1000;
    const alicePrivateKey = '0x7151e5dab6f8e95b5436515b83f423c4df64fe4c6149f864daa209b26adb10ca';
    let alice;

    before('setup test contract', async () => {
        this.test = await TxFinalizationVerifier.new();
    });

    before('setup alice account with custom private key', async () => {
        const password = 'password1234';
        alice = await web3.eth.personal.importRawKey(alicePrivateKey, password);
        alice = web3.utils.toChecksumAddress(alice);
        web3.eth.personal.unlockAccount(alice, password, 3600);
        web3.eth.sendTransaction({
            to: alice,
            from: richFather,
            value: web3.utils.toWei('1', 'ether'),
        });
    });

    describe('isStandardFinalized', () => {
        beforeEach(async () => {
            this.framework = await PlasmaFramework.new(0, 0, 0);
        });

        it('should revert when invalid protocol value provided', async () => {
            const invalidProtocol = 199;

            const data = [
                constants.ZERO_ADDRESS,
                invalidProtocol,
                EMPTY_BYTES,
                [0],
                EMPTY_BYTES,
                EMPTY_BYTES,
                constants.ZERO_ADDRESS,
            ];

            await expectRevert(
                this.test.isStandardFinalized(data),
                'Invalid protocol value',
            );
        });

        describe('Given MVP protocol', () => {
            beforeEach(async () => {
                const txBytes = web3.utils.utf8ToHex('dummy tx');
                const txPos = buildTxPos(TEST_BLOCK_NUM, 0);
                this.merkle = new MerkleTree([txBytes], 3);

                this.data = [
                    this.framework.address,
                    PROTOCOL.MVP,
                    txBytes,
                    [txPos],
                    this.merkle.getInclusionProof(txBytes),
                    sign(this.merkle.root, alicePrivateKey),
                    alice,
                ];
            });

            it('should revert as it is not supported in this implementation', async () => {
                await this.framework.setBlock(TEST_BLOCK_NUM, this.merkle.root, 0);
                await expectRevert(
                    this.test.isStandardFinalized(this.data),
                    'MVP is not yet supported',
                );
            });
        });

        describe('Given MoreVP protocol', () => {
            beforeEach(async () => {
                const txBytes = web3.utils.utf8ToHex('dummy tx');
                const txPos = buildTxPos(TEST_BLOCK_NUM, 0);
                this.merkle = new MerkleTree([txBytes], 3);

                this.data = [
                    this.framework.address,
                    PROTOCOL.MORE_VP,
                    txBytes,
                    [txPos],
                    this.merkle.getInclusionProof(txBytes),
                    EMPTY_BYTES,
                    constants.ZERO_ADDRESS,
                ];
            });

            it('should return true given valid inclusion proof', async () => {
                await this.framework.setBlock(TEST_BLOCK_NUM, this.merkle.root, 0);

                expect(await this.test.isStandardFinalized(this.data)).to.be.true;
            });

            it('should return false given empty inclusion proof', async () => {
                await this.framework.setBlock(TEST_BLOCK_NUM, this.merkle.root, 0);

                const inclusionProofIndex = 4;
                this.data[inclusionProofIndex] = EMPTY_BYTES;

                expect(await this.test.isStandardFinalized(this.data)).to.be.false;
            });

            it('should return false given invalid inclusion proof', async () => {
                // makes sure the inclusion proof mismatch with the root hash
                const invalidRoot = web3.utils.sha3('invalid root');
                await this.framework.setBlock(TEST_BLOCK_NUM, invalidRoot, 0);

                expect(await this.test.isStandardFinalized(this.data)).to.be.false;
            });
        });
    });

    describe('isProtocolFinalized', () => {
        it('should revert when invalid protocol value provided', async () => {
            const invalidProtocol = 199;

            const data = [
                constants.ZERO_ADDRESS,
                invalidProtocol,
                EMPTY_BYTES,
                [0],
                EMPTY_BYTES,
                EMPTY_BYTES,
                constants.ZERO_ADDRESS,
            ];

            await expectRevert(
                this.test.isProtocolFinalized(data),
                'Invalid protocol value',
            );
        });

        describe('Given MVP protocol', () => {
            beforeEach(async () => {
                const txBytes = web3.utils.utf8ToHex('dummy tx');
                const txPos = buildTxPos(TEST_BLOCK_NUM, 0);
                this.merkle = new MerkleTree([txBytes], 3);

                this.data = [
                    this.framework.address,
                    PROTOCOL.MVP,
                    txBytes,
                    [txPos],
                    this.merkle.getInclusionProof(txBytes),
                    sign(this.merkle.root, alicePrivateKey),
                    alice,
                ];
            });

            it('should revert as it is not supported in this implementation', async () => {
                await this.framework.setBlock(TEST_BLOCK_NUM, this.merkle.root, 0);
                await expectRevert(
                    this.test.isProtocolFinalized(this.data),
                    'MVP is not yet supported',
                );
            });
        });

        describe('Given MoreVP protocol', () => {
            it('should return true when tx exist', async () => {
                const txBytes = web3.utils.utf8ToHex('dummy tx');

                const data = [
                    constants.ZERO_ADDRESS,
                    PROTOCOL.MORE_VP,
                    txBytes, // should pass as long as this is non empty
                    [0],
                    EMPTY_BYTES,
                    EMPTY_BYTES,
                    constants.ZERO_ADDRESS,
                ];

                expect(await this.test.isProtocolFinalized(data)).to.be.true;
            });
        });
    });
});
