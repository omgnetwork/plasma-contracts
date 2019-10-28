/**
 * @author Hamdi Allam hamdi.allam97@gmail.com
 * @notice RLP decoding library forked from https://github.com/hamdiallam/Solidity-RLP
 * @dev Added more test cases from https://github.com/ethereum/tests/tree/master/RLPTests
 *      Created more custom invalid test cases
 *      Added more checks to ensure the decoder reads within bounds of the input length
*/

pragma solidity ^0.5.0;

library RLPReader {
    uint8 constant internal STRING_SHORT_START = 0x80;
    uint8 constant internal STRING_LONG_START  = 0xb8;
    uint8 constant internal LIST_SHORT_START   = 0xc0;
    uint8 constant internal LIST_LONG_START    = 0xf8;
    uint8 constant internal MAX_SHORT_LEN      = 55;
    uint8 constant internal WORD_SIZE = 32;

    struct RLPItem {
        uint len;
        uint memPtr;
    }

    /**
     * @notice Convert a dynamic bytes array into an RLPItem
     * @param item RLP encoded bytes
     * @return The decoded RLPItem
     */
    function toRlpItem(bytes memory item) internal pure returns (RLPItem memory) {
        uint memPtr;

        // solhint-disable-next-line no-inline-assembly
        assembly {
            memPtr := add(item, 0x20)
        }

        return RLPItem(item.length, memPtr);
    }

    /**
    * @notice Convert a dynamic bytes array into a list of RLPItems
    * @param item RLP encoded list in bytes
    * @return A list of RLPItems
    */
    function toList(RLPItem memory item) internal pure returns (RLPItem[] memory) {
        require(isList(item), "Item is not a list");

        uint listLength = decodeItemLengthUnsafe(item.memPtr);
        require(listLength <= item.len, "Decoded list length is larger than input data");

        uint items = countEncodedItems(item);
        RLPItem[] memory result = new RLPItem[](items);

        uint memPtr = item.memPtr + decodePayloadOffset(item);
        uint dataLen;
        uint lengthSum;
        for (uint i = 0; i < items; i++) {
            dataLen = decodeItemLengthUnsafe(memPtr);
            lengthSum += dataLen;
            require(lengthSum < item.len, "Invalid rlp item length");
            result[i] = RLPItem(dataLen, memPtr);
            memPtr = memPtr + dataLen;
        }

        return result;
    }

    // @return indicator whether encoded payload is a list. negate this function call for isData.
    function isList(RLPItem memory item) internal pure returns (bool) {
        if (item.len == 0) return false;

        uint8 byte0;
        uint memPtr = item.memPtr;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            byte0 := byte(0, mload(memPtr))
        }

        if (byte0 < LIST_SHORT_START)
            return false;
        return true;
    }

    /**
     * @notice Convert a RLPItem into a dynamic bytes array
     * @param item RLPItem
     * @return Raw rlp encoding in bytes
     */
    function toRlpBytes(RLPItem memory item) internal pure returns (bytes memory) {
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

    function toAddress(RLPItem memory item) internal pure returns (address) {
        // 1 byte for the length prefix
        require(item.len == 21, "Item length must be == 21");

        return address(toUint(item));
    }

    /**
     * @notice Create a uint from a RLPItem
     * @param item RLPItem
     */
    function toUint(RLPItem memory item) internal pure returns (uint) {
        require(item.len > 0 && item.len <= 33, "Item length must be <= 33");
        uint itemLen = decodeItemLengthUnsafe(item.memPtr);
        require(itemLen <= item.len, "Length is larger than input data");

        uint offset = decodePayloadOffset(item);
        uint len = itemLen - offset;

        uint result;
        uint memPtr = item.memPtr + offset;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            result := mload(memPtr)
            // shift to the correct location if necessary
            if lt(len, 32) {
                result := div(result, exp(256, sub(32, len)))
            }
        }

        return result;
    }

    /**
    * @notice Counts the number of payload items inside an RLP encoded list
    * @param item RLPItem
    * @return The number of items in a inside an RLP encoded list
    */
    function countEncodedItems(RLPItem memory item) private pure returns (uint) {
        if (item.len == 0) return 0;

        uint count = 0;
        uint currPtr = item.memPtr + decodePayloadOffset(item);
        uint endPtr = item.memPtr + item.len;
        while (currPtr < endPtr) {
            currPtr = currPtr + decodeItemLengthUnsafe(currPtr); // skip over an item
            require(currPtr <= endPtr, "Invalid RLP item length");
            count++;
        }

        return count;
    }

    /**
     * @notice Decodes the RLPItems length from a bytes array.
     * @param memPtr Pointer to the dynamic bytes array in memory
     * @return The encoded RLPItem length
     */
    function decodeItemLengthUnsafe(uint memPtr) private pure returns (uint) {
        uint decodedItemLengthUnsafe;
        uint byte0;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            byte0 := byte(0, mload(memPtr))
        }

        if (byte0 < STRING_SHORT_START) {
            decodedItemLengthUnsafe = 1;
        } else if (byte0 < STRING_LONG_START) {
            decodedItemLengthUnsafe = byte0 - STRING_SHORT_START + 1;
        } else if (byte0 < LIST_SHORT_START) {
            uint dataLen;
            uint byte1;
            // solhint-disable-next-line no-inline-assembly
            assembly {
                let byteLen := sub(byte0, 0xb7) // # of bytes the actual length is
                memPtr := add(memPtr, 1) // skip over the first byte

                byte1 := byte(0, mload(memPtr))

                /* 32 byte word size */
                dataLen := div(mload(memPtr), exp(256, sub(32, byteLen))) // right shifting to get the len
                decodedItemLengthUnsafe := add(dataLen, add(byteLen, 1))
            }
            // Check valid long string i.e. value of length > MAX_SHORT_LEN with no leading zeros
            require(byte1 != 0, "Invalid RLP encoding");
            require(dataLen > MAX_SHORT_LEN, "Invalid RLP encoding");
        } else if (byte0 < LIST_LONG_START) {
            decodedItemLengthUnsafe = byte0 - LIST_SHORT_START + 1;
        } else {
            uint dataLen;
            uint byte1;
            // solhint-disable-next-line no-inline-assembly
            assembly {
                let lengthLen := sub(byte0, 0xf7)
                memPtr := add(memPtr, 1)

                byte1 := byte(0, mload(memPtr))

                // TODO audit prep, check this shifting for overflow, etc
                dataLen := div(mload(memPtr), exp(256, sub(32, lengthLen))) // right shifting to the correct length
                decodedItemLengthUnsafe := add(dataLen, add(lengthLen, 1))
            }
            // Check valid long list i.e. value of length > MAX_SHORT_LEN with no leading zeros
            require(byte1 != 0, "Invalid RLP encoding");
            require(dataLen > MAX_SHORT_LEN, "Invalid RLP encoding");
        }

        

        return decodedItemLengthUnsafe;
    }

    /**
     * @notice Decode the length of the RLPItem payload length
     * @param item RLPItem
     * @return Length of the RLPItem payload length
     */
    function decodePayloadOffset(RLPItem memory item) private pure returns (uint) {
        uint byte0;
        uint payloadOffsetLength;
        uint memPtr = item.memPtr;

        // solhint-disable-next-line no-inline-assembly
        assembly {
            byte0 := byte(0, mload(memPtr))
        }

        if (byte0 < STRING_SHORT_START) {
            payloadOffsetLength = 0;
        } else if (byte0 < STRING_LONG_START) {
            if (item.len == 2){
                uint byte1;
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    byte1 := byte(0, mload(add(memPtr, 1)))
                }
                require(byte1 >= STRING_SHORT_START, "Invalid RLP encoding");
            }
            payloadOffsetLength = 1;
        } else if (byte0 >= LIST_SHORT_START && byte0 < LIST_LONG_START){
            payloadOffsetLength = 1;
        } else if (byte0 < LIST_SHORT_START) {
            payloadOffsetLength = byte0 - (STRING_LONG_START - 1) + 1;
        } else {
            payloadOffsetLength = byte0 - (LIST_LONG_START - 1) + 1;
        }

        require(payloadOffsetLength <= item.len, "Encoded RLPItem payload length is invalid");

        return payloadOffsetLength;
    }

    /**
    * @notice Copies the number of bytes from one memory location to another. Caller needs to check
    *         the length of dst and ensure that structure at dst does not overflow.
    * @param src Pointer to source
    * @param dest Pointer to destination
    * @param len Amount of memory to copy from the source
    */
    function copyUnsafe(uint src, uint dest, uint len) private pure {
        if (len == 0) return;

        // copy as many word sizes as possible
        for (; len >= WORD_SIZE; len -= WORD_SIZE) {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                mstore(dest, mload(src))
            }

            src += WORD_SIZE;
            dest += WORD_SIZE;
        }

        // left over bytes. Mask is used to remove unwanted bytes from the word
        uint mask = 256 ** (WORD_SIZE - len) - 1;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            let srcpart := and(mload(src), not(mask)) // zero out src
            let destpart := and(mload(dest), mask) // retrieve the bytes
            mstore(dest, or(destpart, srcpart))
        }
    }

    /**
     * @notice Convert RLPItem in a dynamic bytes array
     */
    function toBytes(RLPItem memory item) internal pure returns (bytes memory) {
        require(item.len > 0, "Item length must be > 0");

        uint itemLen = decodeItemLengthUnsafe(item.memPtr);
        require(itemLen <= item.len, "Length is larger than data");

        uint offset = decodePayloadOffset(item);
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

}
