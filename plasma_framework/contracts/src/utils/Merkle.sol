pragma solidity 0.5.11;

/**
 * @title Merkle
 * @dev Library for working with Merkle trees
 */
library Merkle {
    byte private constant LEAF_SALT = 0x00;
    byte private constant NODE_SALT = 0x01;

    /**
     * @notice Checks that a leaf hash is contained in a root hash
     * @param leaf Leaf hash to verify
     * @param index Position of the leaf hash in the Merkle tree
     * @param rootHash Root of the Merkle tree
     * @param proof A Merkle proof demonstrating membership of the leaf hash
     * @return True, if the leaf hash is in the Merkle tree; otherwise, False
    */
    function checkMembership(bytes memory leaf, uint256 index, bytes32 rootHash, bytes memory proof)
        internal
        pure
        returns (bool)
    {
        require(proof.length % 32 == 0, "Length of Merkle proof must be a multiple of 32");

        bytes32 proofElement;
        bytes32 computedHash = keccak256(abi.encodePacked(LEAF_SALT, leaf));
        uint256 j = index;
        // Note: We're skipping the first 32 bytes of `proof`, which holds the size of the dynamically sized `bytes`
        for (uint256 i = 32; i <= proof.length; i += 32) {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                proofElement := mload(add(proof, i))
            }
            if (j % 2 == 0) {
                computedHash = keccak256(abi.encodePacked(NODE_SALT, computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(NODE_SALT, proofElement, computedHash));
            }
            j = j / 2;
        }

        return computedHash == rootHash;
    }
}
