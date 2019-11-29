pragma solidity 0.5.11;

pragma experimental ABIEncoderV2;

import "../../src/utils/RLPReader.sol";

contract RLPMock {

    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;

    uint8 constant internal WORD_SIZE = 32;

    function decodeBytes32(bytes memory _data) public pure returns (bytes32) {
        return _data.toRlpItem().toBytes32();
    }

    function decodeAddress(bytes memory _data) public pure returns (address) {
        return _data.toRlpItem().toAddress();
    }
    
    function decodeBytes20(bytes memory _data) public pure returns (bytes20) {
        return bytes20(_data.toRlpItem().toAddress());
    }

    function decodeBytes(bytes memory _data) public pure returns (bytes memory) {
        return toBytes(_data.toRlpItem());
    }

    function decodeUint(bytes memory _data) public pure returns (uint) {
        return _data.toRlpItem().toUint();
    }

    function decodeInt(bytes memory _data) public pure returns (int) {
        return int(_data.toRlpItem().toUint());
    }

    function decodeString(bytes memory _data) public pure returns (string memory) {
        return string(toBytes(_data.toRlpItem()));
    }

    function decodeList(bytes memory _data) public pure returns (bytes[] memory) {

        RLPReader.RLPItem[] memory items = _data.toRlpItem().toList();

        bytes[] memory result =  new bytes[](items.length);
        for (uint i = 0; i < items.length; i++) {
            result[i] = toRlpBytes(items[i]);
        }
        return result;
    }

    function toBytes(RLPReader.RLPItem memory item) internal pure returns (bytes memory) {
        require(item.len > 0, "Item length must be > 0");

        (uint256 itemLen, uint256 offset) = RLPReader.decodeLengthAndOffset(item.memPtr);
        require(itemLen == item.len, "Decoded RLP length is invalid");
        uint len = itemLen - offset;
        bytes memory result = new bytes(len);

        uint destPtr;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            destPtr := add(0x20, result)
        }

        copyUnsafe(item.memPtr + offset, destPtr, len);
        return result;
    }

    function copyUnsafe(uint src, uint dest, uint len) private pure {
        if (len == 0) return;
        uint remainingLength = len;

        // copy as many word sizes as possible
        for (uint i = WORD_SIZE; len >= i; i += WORD_SIZE) {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                mstore(dest, mload(src))
            }

            src += WORD_SIZE;
            dest += WORD_SIZE;
            remainingLength -= WORD_SIZE;
            require(remainingLength < len, "Remaining length not less than original length");
        }

        // left over bytes. Mask is used to remove unwanted bytes from the word
        uint mask = 256 ** (WORD_SIZE - remainingLength) - 1;

        // solhint-disable-next-line no-inline-assembly
        assembly {
            let srcpart := and(mload(src), not(mask)) // zero out src
            let destpart := and(mload(dest), mask) // retrieve the bytes
            mstore(dest, or(destpart, srcpart))
        }
    }

    function toRlpBytes(RLPReader.RLPItem memory item) internal pure returns (bytes memory) {
        bytes memory result = new bytes(item.len);
        if (result.length == 0) return result;

        uint resultPtr;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            resultPtr := add(0x20, result)
        }

        copyUnsafe(item.memPtr, resultPtr, item.len);
        return result;
    }
}
