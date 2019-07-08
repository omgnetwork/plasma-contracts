pragma solidity ^0.5.0;

/**
 * @title SliceUtils
 * @notice Utilities for slicing bytes.
 */
library SliceUtils {

    uint256 constant internal PROOF_SIZE_BYTES = 512;
    uint256 constant internal SIGNATURE_SIZE_BYTES = 65;

    /**
     * @notice Slices a signature off a list of signatures.
     * @param _signatures A list of signatures in bytes form.
     * @param _index Which signature to slice.
     * @return A signature in bytes form.
     */
    function sliceSignature(bytes memory _signatures, uint256 _index)
        internal
        pure
        returns (bytes memory)
    {
        return _sliceOne(_signatures, SIGNATURE_SIZE_BYTES, _index);
    }
    /**

     * @notice Slices a Merkle proof off a list of proofs.
     * @param _proofs A list of proofs in bytes form.
     * @param _index Which proof to slice.
     * @return A proof in bytes form.
     */
    function sliceProof(bytes memory _proofs, uint256 _index)
        internal
        pure
        returns (bytes memory)
    {
        return _sliceOne(_proofs, PROOF_SIZE_BYTES, _index);
    }

    /**
     * @notice Slices an element off a list of equal-sized elements in bytes form.
     * @param _list A list of equal-sized elements in bytes.
     * @param _length Size of each item.
     * @param _index Which item to slice.
     * @return A single element at the specified index.
     */
    function _sliceOne(bytes memory _list, uint256 _length, uint256 _index)
        private
        pure
        returns (bytes memory)
    {
        return slice(_list, _length * _index, _length);
    }

    /**
     * @notice Slices off bytes from a byte string.
     * @param _bytes Byte string to slice.
     * @param _start Starting index of the slice.
     * @param _length Length of the slice.
     * @return The slice of the byte string.
     */
    function slice(bytes memory _bytes, uint _start, uint _length)
        private
        pure
        returns (bytes memory)
    {
        require(_bytes.length >= (_start + _length), "Bytes too short to slice");

        bytes memory tempBytes;

        assembly {
            switch iszero(_length)
            case 0 {
                tempBytes := mload(0x40)

                let lengthmod := and(_length, 31)

                let mc := add(add(tempBytes, lengthmod), mul(0x20, iszero(lengthmod)))
                let end := add(mc, _length)

                for {
                    let cc := add(add(add(_bytes, lengthmod), mul(0x20, iszero(lengthmod))), _start)
                } lt(mc, end) {
                    mc := add(mc, 0x20)
                    cc := add(cc, 0x20)
                } {
                    mstore(mc, mload(cc))
                }

                mstore(tempBytes, _length)

                mstore(0x40, and(add(mc, 31), not(31)))
            }
            default {
                tempBytes := mload(0x40)

                mstore(0x40, add(tempBytes, 0x20))
            }
        }

        return tempBytes;
    }
}
