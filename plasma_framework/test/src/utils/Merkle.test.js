const Merkle = artifacts.require('MerkleWrapper');

const { expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { MerkleTree } = require('../../helpers/merkle.js');

contract('Merkle', () => {
    const maxSize = 2 ** 16;
    const leaves = [...Array(maxSize).keys()].map(index => `leaf ${index}`);

    before('setup merkle contract and tree value', async () => {
        this.merkleContract = await Merkle.new();
        this.merkleTree = new MerkleTree(leaves);
    });

    describe('checkMembership', () => {
        describe('Prove inclusion', () => {
            const testIndex = [0, 1, 2, 3, maxSize - 2, maxSize - 1];

            testIndex.forEach((leafIndex) => {
                it(`should return true for index ${leafIndex}`, async () => {
                    const leafData = web3.utils.sha3(leaves[leafIndex]);
                    const rootHash = this.merkleTree.root;
                    const proof = this.merkleTree.getInclusionProof(leaves[leafIndex]);

                    const result = await this.merkleContract.checkMembership(leafData, leafIndex, rootHash, proof);
                    expect(result).to.be.true;
                });
            });
        });

        it('should return false when not able to prove included', async () => {
            const leafIndex = 0;
            const leafData = web3.utils.sha3(leaves[leafIndex]);
            const fakeRootHash = web3.utils.sha3('random root hash');
            const proof = this.merkleTree.getInclusionProof(leaves[leafIndex]);

            const result = await this.merkleContract.checkMembership(leafData, leafIndex, fakeRootHash, proof);
            expect(result).to.be.false;
        });

        it('should reject call when proof data size is incorrect', async () => {
            const leafIndex = 0;
            const leafData = web3.utils.sha3(leaves[leafIndex]);
            const rootHash = this.merkleTree.root;
            const proof = this.merkleTree.getInclusionProof(leaves[leafIndex]);
            const wrongSizeProof = `${proof}13212`;

            await expectRevert(
                this.merkleContract.checkMembership(leafData, leafIndex, rootHash, wrongSizeProof),
                'Length of Merkle proof must be a multiple of 32',
            );
        });
    });
});
