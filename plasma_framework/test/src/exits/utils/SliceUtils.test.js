const SliceUtils = artifacts.require('SliceUtilsWrapper');

const { expect } = require('chai');
const { expectRevert } = require('openzeppelin-test-helpers');

const { MerkleTree } = require('../../../helpers/merkle.js');

contract('SliceUtils', () => {
    const MERKLE_TREE_HEIGHT = 16;
    const SIGNATURE_LENGTH_IN_BYTES = 65;

    before('setup', async () => {
        this.contract = await SliceUtils.new();
    });

    describe('slices proofs', () => {
        it('should correctly slice a proof', async () => {
            const merkle = new MerkleTree(['leaf1', 'leaf2'], MERKLE_TREE_HEIGHT);
            const proof1 = merkle.getInclusionProof('leaf1');
            const proof2 = merkle.getInclusionProof('leaf2');
            const proofs = proof1 + proof2.slice(2);

            const proof = await this.contract.sliceProof(proofs, 1);
            expect(proof).to.be.equal(proof2);
        });

        it('should revert for incorrect proof size', async () => {
            const proofs = web3.utils.bytesToHex('incorrectlengthproofs');
            await expectRevert(this.contract.sliceProof(proofs, 0), 'Bytes too short to slice');
        });
    });

    describe('slices signatures', () => {
        it('should correctly slice a signature', async () => {
            const signature1 = 'a'.repeat(SIGNATURE_LENGTH_IN_BYTES);
            const signature2 = 'b'.repeat(SIGNATURE_LENGTH_IN_BYTES);
            const signatures = web3.utils.bytesToHex(`${signature1}${signature2}`);
            const signature = await this.contract.sliceSignature(signatures, 1);
            expect(signature).to.be.equal(web3.utils.bytesToHex(signature2));
        });

        it('should revert for incorrect signatures size', async () => {
            const signatures = web3.utils.bytesToHex('incorrectsignature');
            await expectRevert(this.contract.sliceSignature(signatures, 0), 'Bytes too short to slice');
        });
    });
});
