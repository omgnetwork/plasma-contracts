pragma solidity ^0.5.0;

library ZeroHashesProvider {
    // This is some optimization while building merkle tree for deposit block
    // Pre-compute the essential data once and reuse in every deposit
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
