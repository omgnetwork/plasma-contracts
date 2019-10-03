pragma solidity 0.5.11;

import "../../src/utils/Merkle.sol";

contract MerkleWrapper {

    function checkMembership(bytes32 leaf, uint256 index, bytes32 rootHash, bytes memory proof)
        public
        pure
        returns (bool)
    {
        return Merkle.checkMembership(leaf, index, rootHash, proof);
    }
}
