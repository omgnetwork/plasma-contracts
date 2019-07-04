const Merkle = artifacts.require('MerkleWrapper');

const { expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { MerkleTree } = require('../../helpers/merkle.js');

contract('Merkle', () => {
    before('setup merkle contract and tree value', async () => {
        this.merkleContract = await Merkle.new();
        this.leaves = ['leaf 1', 'leaf 2', 'leaf 3'];
        this.merkleTree = new MerkleTree(this.leaves);
    });

    describe('checkMembership', () => {
        it('should return true when proven included', async () => {
            const leafIndex = 0;
            const leafData = web3.utils.sha3(this.leaves[leafIndex]);
            const rootHash = this.merkleTree.root;
            const proof = this.merkleTree.getInclusionProof(this.leaves[leafIndex]);

            const result = await this.merkleContract.checkMembership(leafData, leafIndex, rootHash, proof);
            expect(result).to.be.true;
        });

        it('should return false when not able to prove included', async () => {
            const leafIndex = 0;
            const leafData = web3.utils.sha3(this.leaves[leafIndex]);
            const fakeRootHash = web3.utils.sha3('random root hash');
            const proof = this.merkleTree.getInclusionProof(this.leaves[leafIndex]);

            const result = await this.merkleContract.checkMembership(leafData, leafIndex, fakeRootHash, proof);
            expect(result).to.be.false;
        });

        it('should reject call when proof data size is incorrect', async () => {
            const leafIndex = 0;
            const leafData = web3.utils.sha3(this.leaves[leafIndex]);
            const rootHash = this.merkleTree.root;
            const proof = this.merkleTree.getInclusionProof(this.leaves[leafIndex]);
            const wrongSizeProof = `${proof}13212`;

            await expectRevert(
                this.merkleContract.checkMembership(leafData, leafIndex, rootHash, wrongSizeProof),
                'Length of merkle proof must be a multiple of of 32.',
            );
        });
    });
});
