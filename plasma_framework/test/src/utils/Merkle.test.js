const Merkle = artifacts.require('MerkleWrapper');

const { expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { MerkleTree } = require('../../helpers/merkle.js');

const Testlang = require('../../helpers/testlang.js');
const config = require('../../../config.js');

contract('Merkle', () => {
    const maxSize = 2 ** 16;
    const DEPOSIT_VALUE = 1000000;
    const OUTPUT_TYPE_PAYMENT = config.registerKeys.outputTypes.payment;
    const MERKLE_TREE_DEPTH = 16;

    const alicePrivateKey = '0x7151e5dab6f8e95b5436515b83f423c4df64fe4c6149f864daa209b26adb10ca';
    const password = 'password1234';

    before('setup merkle contract', async () => {
        this.merkleContract = await Merkle.new();
    });

    describe('checkMembership', () => {
        const leaves = [...Array(maxSize).keys()].map(index => web3.utils.bytesToHex(`leaf ${index}`));

        before('setup tree value', async () => {
            this.merkleTree = new MerkleTree(leaves, MERKLE_TREE_DEPTH);
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
        let alice = await web3.eth.personal.importRawKey(alicePrivateKey, password);
        alice = web3.utils.toChecksumAddress(alice);

        const depositTx = Testlang.deposit(OUTPUT_TYPE_PAYMENT, DEPOSIT_VALUE, alice);
        const merkleTreeForDepositTx = new MerkleTree([depositTx]);
        const merkleProofForDepositTx = merkleTreeForDepositTx.getInclusionProof(depositTx);

        const result = await this.merkleContract.checkMembership(
            depositTx,
            0,
            merkleTreeForDepositTx.root,
            merkleProofForDepositTx,
        );
        expect(result).to.be.true;
    });
});
