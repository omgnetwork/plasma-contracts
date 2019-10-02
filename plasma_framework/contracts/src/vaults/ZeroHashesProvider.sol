pragma solidity 0.5.11;

library ZeroHashesProvider {

    /**
     * @dev Pre-computes zero hashes to be used for building merkle tree for deposit block
     */
    function getZeroHashes() internal pure returns (bytes32[16] memory) {
        bytes32[16] memory zeroHashes;
        bytes32 zeroHash = keccak256(abi.encodePacked(uint256(0)));
        for (uint i = 0; i < 16; i++) {
            zeroHashes[i] = zeroHash;
            zeroHash = keccak256(abi.encodePacked(zeroHash, zeroHash));
        }
        return zeroHashes;
    }
}
