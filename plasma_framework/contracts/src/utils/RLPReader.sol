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
        require(listLength == item.len, "Decoded RLP length for list is invalid");

        uint items = countEncodedItems(item);
        RLPItem[] memory result = new RLPItem[](items);

        uint memPtr = item.memPtr + decodePayloadOffset(item);
        uint dataLen;
        uint lengthSum;
        for (uint i = 0; i < items; i++) {
            dataLen = decodeItemLengthUnsafe(memPtr);
            lengthSum += dataLen;
            require(lengthSum < item.len, "Decoded length of RLP item in list is invalid");
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

    function toAddress(RLPItem memory item) internal pure returns (address) {
        // 1 byte for the length prefix
        require(item.len == 21, "Item length must be 21");

        return address(toUint(item));
    }

    /**
     * @notice Create a uint from a RLPItem
     * @param item RLPItem
     */
    function toUint(RLPItem memory item) internal pure returns (uint) {
        require(item.len > 0 && item.len <= 33, "Item length must be between 1 and 33 bytes");
        uint itemLen = decodeItemLengthUnsafe(item.memPtr);
        require(itemLen <= item.len, "Decoded length is greater than input data");

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
        uint count = 0;
        uint currPtr = item.memPtr + decodePayloadOffset(item);
        uint endPtr = item.memPtr + item.len;
        while (currPtr < endPtr) {
            currPtr = currPtr + decodeItemLengthUnsafe(currPtr);
            require(currPtr <= endPtr, "Invalid decoded length of RLP item found during counting items in a list");
            count++;
        }

        return count;
    }

    /**
     * @notice Decodes the RLPItems length from a bytes array.
     * @param memPtr Pointer to the dynamic bytes array in memory
     * @return The encoded RLPItem length
     */
    function decodeItemLengthUnsafe(uint memPtr) internal pure returns (uint) {
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
    function decodePayloadOffset(RLPItem memory item) internal pure returns (uint) {
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


}
