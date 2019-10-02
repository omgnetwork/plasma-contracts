pragma solidity 0.5.11;

/**
 * @title Merkle
 * @dev Library for working with Merkle trees.
 */
library Merkle {

    /**
     * @notice Checks that a leaf hash is contained in a root hash.
     * @param leaf Leaf hash to verify.
     * @param index Position of the leaf hash in the Merkle tree.
     * @param rootHash Root of the Merkle tree.
     * @param proof A Merkle proof demonstrating membership of the leaf hash.
     * @return True of the leaf hash is in the Merkle tree. False otherwise.
    */
    function checkMembership(bytes32 leaf, uint256 index, bytes32 rootHash, bytes memory proof)
        internal
        pure
        returns (bool)
    {
        require(proof.length % 32 == 0, "Length of merkle proof must be a multiple of of 32.");

        bytes32 proofElement;
        bytes32 computedHash = leaf;
        uint256 j = index;
        // NOTE: we're skipping the first 32 bytes of `proof`, which holds the size of the dynamically sized `bytes`
        for (uint256 i = 32; i <= proof.length; i += 32) {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                proofElement := mload(add(proof, i))
            }
            if (j % 2 == 0) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
            j = j / 2;
        }

        return computedHash == rootHash;
    }
}
