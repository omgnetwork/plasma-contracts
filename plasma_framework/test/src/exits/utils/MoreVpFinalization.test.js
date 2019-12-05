const MoreVpFinalization = artifacts.require('MoreVpFinalizationWrapper');
const PlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');

const { expect } = require('chai');
const { expectRevert } = require('openzeppelin-test-helpers');

const { buildTxPos } = require('../../../helpers/positions.js');
const { MerkleTree } = require('../../../helpers/merkle.js');
const { PROTOCOL, EMPTY_BYTES } = require('../../../helpers/constants.js');
const { WireTransaction } = require('../../../helpers/transaction.js');

contract('MoreVpFinalization', () => {
    const MORE_VP_TX_TYPE = 1;
    const MVP_TX_TYPE = 2;
    const TEST_BLOCK_NUM = 1000;

    before('setup test contract', async () => {
        this.test = await MoreVpFinalization.new();
    });

    beforeEach(async () => {
        this.framework = await PlasmaFramework.new(0, 0, 0);

        // just need a dummy contract to register
        const dummyMoreVpExitGame = await MoreVpFinalization.new();
        const dummyMvpExitGame = await MoreVpFinalization.new();

        this.framework.registerExitGame(MORE_VP_TX_TYPE, dummyMoreVpExitGame.address, PROTOCOL.MORE_VP);
        this.framework.registerExitGame(MVP_TX_TYPE, dummyMvpExitGame.address, PROTOCOL.MVP);
    });

    describe('isStandardFinalized', () => {
        it('should revert when the tx type is not registered to the framework yet', async () => {
            const newTxType = 9878;

            const tx = new WireTransaction(newTxType, [], []);
            const txBytes = web3.utils.bytesToHex(tx.rlpEncoded());

            await expectRevert(
                this.test.isStandardFinalized(
                    this.framework.address,
                    txBytes,
                    0,
                    EMPTY_BYTES,
                ),
                'MoreVpFinalization: not a MoreVP protocol tx',
            );
        });

        describe('Given MVP protocol', () => {
            beforeEach(async () => {
                const tx = new WireTransaction(MVP_TX_TYPE, [], []);

                this.txBytes = web3.utils.bytesToHex(tx.rlpEncoded());
                this.txPos = buildTxPos(TEST_BLOCK_NUM, 0);
                this.merkle = new MerkleTree([this.txBytes], 3);
            });

            it('should revert as it is not supported by this library', async () => {
                await this.framework.setBlock(TEST_BLOCK_NUM, this.merkle.root, 0);
                await expectRevert(
                    this.test.isStandardFinalized(
                        this.framework.address,
                        this.txBytes,
                        this.txPos,
                        this.merkle.getInclusionProof(this.txBytes),
                    ),
                    'MoreVpFinalization: not a MoreVP protocol tx',
                );
            });
        });

        describe('Given MoreVP protocol', () => {
            beforeEach(async () => {
                const tx = new WireTransaction(MORE_VP_TX_TYPE, [], []);

                this.txBytes = web3.utils.bytesToHex(tx.rlpEncoded());
                this.txPos = buildTxPos(TEST_BLOCK_NUM, 0);
                this.merkle = new MerkleTree([this.txBytes], 3);
                this.inclusionProof = this.merkle.getInclusionProof(this.txBytes);
            });

            it('should revert if there is no block root hash data in the PlasmaFramework for the position', async () => {
                await expectRevert(
                    this.test.isStandardFinalized(
                        this.framework.address,
                        this.txBytes,
                        this.txPos,
                        this.inclusionProof,
                    ),
                    'Failed to get the root hash of the block num',
                );
            });

            it('should return true given valid inclusion proof', async () => {
                await this.framework.setBlock(TEST_BLOCK_NUM, this.merkle.root, 0);
                const isStandardFinalized = await this.test.isStandardFinalized(
                    this.framework.address,
                    this.txBytes,
                    this.txPos,
                    this.inclusionProof,
                );
                expect(isStandardFinalized).to.be.true;
            });

            it('should return false given empty inclusion proof', async () => {
                await this.framework.setBlock(TEST_BLOCK_NUM, this.merkle.root, 0);

                const isStandardFinalized = await this.test.isStandardFinalized(
                    this.framework.address,
                    this.txBytes,
                    this.txPos,
                    EMPTY_BYTES,
                );
                expect(isStandardFinalized).to.be.false;
            });

            it('should return false given invalid inclusion proof', async () => {
                // makes sure the inclusion proof mismatch with the root hash
                const invalidRoot = web3.utils.sha3('invalid root');
                await this.framework.setBlock(TEST_BLOCK_NUM, invalidRoot, 0);

                const isStandardFinalized = await this.test.isStandardFinalized(
                    this.framework.address,
                    this.txBytes,
                    this.txPos,
                    this.inclusionProof,
                );
                expect(isStandardFinalized).to.be.false;
            });
        });
    });

    describe('isProtocolFinalized', () => {
        it('should revert when the tx type is not registered to the framework yet', async () => {
            const newTxType = 66666;
            const tx = new WireTransaction(newTxType, [], []);
            const txBytes = web3.utils.bytesToHex(tx.rlpEncoded());

            await expectRevert(
                this.test.isProtocolFinalized(
                    this.framework.address,
                    txBytes,
                ),
                'MoreVpFinalization: not a MoreVP protocol tx',
            );
        });

        describe('Given MVP protocol', () => {
            beforeEach(async () => {
                const tx = new WireTransaction(MVP_TX_TYPE, [], []);
                this.txBytes = web3.utils.bytesToHex(tx.rlpEncoded());
            });

            it('should revert as it is not supported by this library', async () => {
                await expectRevert(
                    this.test.isProtocolFinalized(
                        this.framework.address,
                        this.txBytes,
                    ),
                    'MoreVpFinalization: not a MoreVP protocol tx',
                );
            });
        });

        describe('Given MoreVP protocol', () => {
            it('should return true when tx exist', async () => {
                const tx = new WireTransaction(MORE_VP_TX_TYPE, [], []);
                const txBytes = web3.utils.bytesToHex(tx.rlpEncoded());

                const isProtocolFinalized = await this.test.isProtocolFinalized(
                    this.framework.address, txBytes,
                );
                expect(isProtocolFinalized).to.be.true;
            });

            it('should return true when tx is empty', async () => {
                const isProtocolFinalized = await this.test.isProtocolFinalized(
                    this.framework.address, EMPTY_BYTES,
                );
                expect(isProtocolFinalized).to.be.false;
            });
        });
    });
});
