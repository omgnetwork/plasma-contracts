pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../../src/utils/SliceUtils.sol";

contract SliceUtilsWrapper {
    function sliceSignature(bytes memory _signatures, uint256 _index)
        public
        pure
        returns (bytes memory)
    {
        return SliceUtils.sliceSignature(_signatures, _index);
    }

    function sliceProof(bytes memory _proofs, uint256 _index)
        public
        pure
        returns (bytes memory)
    {
        return SliceUtils.sliceProof(_proofs, _index);
    }
}
