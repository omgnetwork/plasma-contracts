const Merkle = artifacts.require('MerkleWrapper');

const { expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { MerkleTree } = require('../../helpers/merkle.js');

contract('Merkle', () => {
    const maxSize = 2 ** 16;

    before('setup merkle contract', async () => {
        this.merkleContract = await Merkle.new();
    });

    describe('checkMembership', () => {
        const leaves = [...Array(maxSize).keys()].map(index => web3.utils.bytesToHex(`leaf ${index}`));

        before('setup tree value', async () => {
            this.merkleTree = new MerkleTree(leaves);
        });

        describe('Prove inclusion', () => {
            const testIndex = [0, 1, 2, 3, maxSize - 2, maxSize - 1];

            testIndex.forEach((leafIndex) => {
                it(`should return true for index ${leafIndex}`, async () => {
                    const rootHash = this.merkleTree.root;
                    const proof = this.merkleTree.getInclusionProof(leaves[leafIndex]);

                    const result = await this.merkleContract.checkMembership(
                        leaves[leafIndex],
                        leafIndex,
                        rootHash,
                        proof,
                    );
                    expect(result).to.be.true;
                });
            });
        });

        it('should return false when not able to prove included', async () => {
            const leafIndex = 0;
            const fakeRootHash = web3.utils.sha3('random root hash');
            const proof = this.merkleTree.getInclusionProof(leaves[leafIndex]);

            const result = await this.merkleContract.checkMembership(
                web3.utils.sha3(leaves[leafIndex]),
                leafIndex,
                fakeRootHash,
                proof,
            );
            expect(result).to.be.false;
        });

        it('should return false when a node preimage is provided as a leaf', async () => {
            const rootHash = this.merkleTree.root;
            const leafProof = this.merkleTree.getInclusionProof(leaves[0]);
            const nodePreimage = this.merkleTree.leaves[0] + this.merkleTree.leaves[1].slice(2);
            const nodeProof = '0x'.concat(leafProof.slice(66));

            const result = await this.merkleContract.checkMembership(
                nodePreimage,
                0,
                rootHash,
                nodeProof,
            );
            expect(result).to.be.false;
        });

        it('should return false when leaf index mismatches the proof', async () => {
            const rootHash = this.merkleTree.root;
            const proof = this.merkleTree.getInclusionProof(leaves[0]);

            const result = await this.merkleContract.checkMembership(
                leaves[0],
                1,
                rootHash,
                proof,
            );
            expect(result).to.be.false;
        });

        it('should reject call when proof data size is incorrect', async () => {
            const leafIndex = 0;
            const leafData = web3.utils.sha3(leaves[leafIndex]);
            const rootHash = this.merkleTree.root;
            const proof = this.merkleTree.getInclusionProof(leaves[leafIndex]);
            const wrongSizeProof = `${proof}13212`;

            await expectRevert(
                this.merkleContract.checkMembership(
                    leafData,
                    leafIndex,
                    rootHash,
                    wrongSizeProof,
                ),
                'Length of Merkle proof must be a multiple of 32',
            );
        });
    });

    it('check membership for tree where some leaves are empty', async () => {
        const leaf = '0x01';
        const merkleTree = new MerkleTree([leaf], 3);
        const proof = merkleTree.getInclusionProof(leaf);

        const result = await this.merkleContract.checkMembership(
            leaf,
            0,
            merkleTree.root,
            proof,
        );
        expect(result).to.be.true;
    });
});
