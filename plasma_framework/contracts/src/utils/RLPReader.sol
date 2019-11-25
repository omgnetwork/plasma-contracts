/**
 * @author Hamdi Allam hamdi.allam97@gmail.com
 * @notice RLP decoding library forked from https://github.com/hamdiallam/Solidity-RLP
 * @dev Some changes that were made to the library are:
 *      - Added more test cases from https://github.com/ethereum/tests/tree/master/RLPTests
 *      - Created more custom invalid test cases
 *      - Added more checks to ensure the decoder reads within bounds of the input length
 *      - Moved utility functions necessary to run some of the tests to the RLPMock.sol
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
        uint256 len;
        uint256 memPtr;
    }

    /**
     * @notice Convert a dynamic bytes array into an RLPItem
     * @param item RLP encoded bytes
     * @return An RLPItem
     */
    function toRlpItem(bytes memory item) internal pure returns (RLPItem memory) {
        uint256 memPtr;

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

        (uint256 listLength, uint256 offset) = decodeLengthAndOffset(item.memPtr);
        require(listLength == item.len, "Decoded RLP length for list is invalid");

        uint256 items = countEncodedItems(item);
        RLPItem[] memory result = new RLPItem[](items);

        uint256 memPtr = item.memPtr + offset;
        uint256 dataLen;
        uint256 lengthSum;
        for (uint256 i = 0; i < items; i++) {
            (dataLen, ) = decodeLengthAndOffset(memPtr);
            lengthSum += dataLen;
            require(lengthSum < item.len, "Decoded length of RLP item in list is invalid");
            result[i] = RLPItem(dataLen, memPtr);
            memPtr = memPtr + dataLen;
        }

        return result;
    }

    /**
    * @notice Check whether the RLPItem is either a list
    * @param item RLP encoded list in bytes
    * @return A boolean whether the RLPItem is a list
    */
    function isList(RLPItem memory item) internal pure returns (bool) {
        if (item.len == 0) return false;

        uint8 byte0;
        uint256 memPtr = item.memPtr;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            byte0 := byte(0, mload(memPtr))
        }

        if (byte0 < LIST_SHORT_START)
            return false;
        return true;
    }

    /**
     * @notice Create an address from a RLPItem
     * @param item RLPItem
     * @return The decoded address
     */
    function toAddress(RLPItem memory item) internal pure returns (address) {
        require(item.len == 21, "Item length must be 21");

        (uint256 itemLen, uint256 offset) = decodeLengthAndOffset(item.memPtr);
        require(itemLen == 21, "Decoded item length must be 21");

        uint256 memPtr = item.memPtr + offset;
        uint256 result;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            result := mload(memPtr)
            // right shift by 12 to make bytes20
            result := div(result, exp(256, 12))
        }

        return address(result);
    }

    /**
     * @notice Create a uint256 from a RLPItem. Leading zeros are invalid.
     * @param item RLPItem
     */
    function toUint(RLPItem memory item) internal pure returns (uint256) {
        require(item.len > 0 && item.len <= 33, "Item length must be between 1 and 33 bytes");
        (uint256 itemLen, uint256 offset) = decodeLengthAndOffset(item.memPtr);
        require(itemLen == item.len, "Decoded item length must be equal to the input data length");

        uint256 dataLen = itemLen - offset;

        uint result;
        uint byte0Data;
        uint memPtrToData = item.memPtr + offset;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            result := mload(memPtrToData)
            byte0Data := byte(0, result)
            // shift to the correct location if necessary
            if lt(dataLen, WORD_SIZE) {
                result := div(result, exp(256, sub(WORD_SIZE, dataLen)))
            }
        }
        require(!(byte0Data == 0 && dataLen > 1), "Leading zeros are invalid");

        return result;
    }

    /**
     * @notice Create a bytes32 from a RLPItem
     * @param item RLPItem
     */
    function toBytes32(RLPItem memory item) internal pure returns (bytes32) {
        // 1 byte for the length prefix
        require(item.len == 33, "Item length must be 33");

        (uint256 itemLen, uint256 offset) = decodeLengthAndOffset(item.memPtr);
        require(itemLen == 33, "Decoded item length must be 33");

        uint256 memPtr = item.memPtr + offset;
        bytes32 result;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            result := mload(memPtr)
        }

        return result;
    }

    /**
    * @notice Counts the number of payload items inside an RLP encoded list
    * @param item RLPItem
    * @return The number of items in a inside an RLP encoded list
    */
    function countEncodedItems(RLPItem memory item) private pure returns (uint256) {
        uint256 count = 0;
        (, uint256 offset) = decodeLengthAndOffset(item.memPtr);
        uint256 currPtr = item.memPtr + offset;
        uint256 endPtr = item.memPtr + item.len;
        while (currPtr < endPtr) {
            (uint256 currLen, ) = decodeLengthAndOffset(currPtr);
            currPtr = currPtr + currLen;
            require(currPtr <= endPtr, "Invalid decoded length of RLP item found during counting items in a list");
            count++;
        }

        return count;
    }

    /**
     * @notice Decodes the RLPItem's length and offset.
     * @dev This function is dangerous !!! Ensure that the returned length is within the bounds of where memPtr points to.
     * @param memPtr Pointer to the dynamic bytes array in memory
     * @return The length of the RLPItem (including the length field) and the offset of the payload
     */
    function decodeLengthAndOffset(uint256 memPtr) internal pure returns (uint256, uint256) {
        uint256 decodedLength;
        uint256 offset;
        uint256 byte0;

        // solhint-disable-next-line no-inline-assembly
        assembly {
            byte0 := byte(0, mload(memPtr))
        }

        if (byte0 < STRING_SHORT_START) {
            // Item is a single byte
            decodedLength = 1;
            offset = 0;
        } else if (STRING_SHORT_START <= byte0 && byte0 < STRING_LONG_START) {
            // The range of the first byte is between 0x80 and 0xb7 then it is a short string
            // The decoded length must be between 1 and 55 bytes
            decodedLength = (byte0 - STRING_SHORT_START) + 1;
            if (decodedLength == 2){
                uint256 byte1;
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    byte1 := byte(0, mload(add(memPtr, 1)))
                }
                // A single byte below 0x80 must be encoded as itself.
                require(byte1 >= STRING_SHORT_START, "Invalid short string encoding");
            }
            offset = 1;
        } else if (STRING_LONG_START <= byte0 && byte0 < LIST_SHORT_START) {
            // Item is a long string (payload length > 55 bytes)
            uint256 dataLen;
            uint256 byte1;
            uint256 lengthLen;

            // solhint-disable-next-line no-inline-assembly
            assembly {
                lengthLen := sub(byte0, 0xb7) // The length of the length of the payload is encoded in the first byte. It must be between 1 and 8 bytes.
            }

            // Check that the length of the length of the payload is valid
            require(0 < lengthLen && lengthLen <= 8, "Invalid length of the length for a long string");

            assembly {
                memPtr := add(memPtr, 1) // skip over the first byte

                // right shift to the correct position
                dataLen := div(mload(memPtr), exp(256, sub(WORD_SIZE, lengthLen)))
                decodedLength := add(dataLen, add(lengthLen, 1))
                byte1 := byte(0, mload(memPtr))
            }

            // Check that the length has no leading zeros
            require(byte1 != 0, "Invalid leading zeros in length of the length for a long string");
            // Check that the value of length > MAX_SHORT_LEN
            require(dataLen > MAX_SHORT_LEN, "Invalid length for a long string");
            // Calculate the offset
            offset = (byte0 - (STRING_LONG_START - 1)) + 1;
        } else if (LIST_SHORT_START <= byte0 && byte0 < LIST_LONG_START) {
            // Item is a short list (length <= 55 bytes)
            decodedLength = (byte0 - LIST_SHORT_START) + 1;
            offset = 1;
        } else {
            // Item is a long list (length > 55 bytes)
            uint256 dataLen;
            uint256 byte1;
            uint256 lengthLen;

            // solhint-disable-next-line no-inline-assembly
            assembly {
                lengthLen := sub(byte0, 0xf7) // The length of the length of the payload is encoded in the first byte. It must be between 1 and 8 bytes.
            }

            // Check that the length of the length of the payload is valid
            require(0 < lengthLen && lengthLen <= 8, "Invalid length of the length for a long list");

            assembly {
                memPtr := add(memPtr, 1) // skip over the first byte

                // right shift to the correct position
                dataLen := div(mload(memPtr), exp(256, sub(WORD_SIZE, lengthLen)))
                decodedLength := add(dataLen, add(lengthLen, 1))
                byte1 := byte(0, mload(memPtr))
            }

            // Check that the length has no leading zeros
            require(byte1 != 0, "Invalid leading zeros in length of the length for a long list");
            // Check that the value of length > MAX_SHORT_LEN
            require(dataLen > MAX_SHORT_LEN, "Invalid length for a long list");
            // Calculate the offset
            offset = (byte0 - (LIST_LONG_START - 1)) + 1;
        }

        return (decodedLength, offset);
    }
}
