pragma solidity 0.5.11;


/**
 * @title RLP
 * @dev Library for RLP decoding
 * Based on https://github.com/androlo/standard-contracts/blob/master/contracts/src/codec/RLP.sol
 */
library RLP {
    /*
     * Storage
     */

    uint internal constant DATA_SHORT_START = 0x80;
    uint internal constant DATA_LONG_START = 0xB8;
    uint internal constant LIST_SHORT_START = 0xC0;
    uint internal constant LIST_LONG_START = 0xF8;

    uint internal constant DATA_LONG_OFFSET = 0xB7;
    uint internal constant LIST_LONG_OFFSET = 0xF7;

    struct RLPItem {
        uint _unsafeMemPtr;    // Pointer to the RLP-encoded bytes
        uint _unsafeLength;    // Number of bytes, which is the full length of the string
    }

    struct Iterator {
        RLPItem _unsafeItem;   // Iterated item
        uint _unsafeNextPtr;   // Position of the next item in the list
    }

    /*
     * Internal functions
     */
    /**
     * @dev Creates an RLPItem from an array of RLP-encoded bytes
     * @param self The RLP-encoded bytes
     * @return An RLPItem
     */
    function toRLPItem(bytes memory self)
        internal
        pure
        returns (RLPItem memory)
    {
        uint len = self.length;
        if (len == 0) {
            return RLPItem(0, 0);
        }
        uint memPtr;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            memPtr := add(self, 0x20)
        }
        return RLPItem(memPtr, len);
    }

    /**
     * @dev Creates an RLPItem from an array of RLP-encoded bytes
     * @param self The RLP-encoded bytes
     * @param strict Triggered when data is not RLP-encoded
     * @return An RLPItem
     */
    function toRLPItem(bytes memory self, bool strict)
        internal
        pure
        returns (RLPItem memory)
    {
        RLPItem memory item = toRLPItem(self);
        if (strict) {
            uint len = self.length;
            require(_payloadOffset(item) <= len, "Invalid RLP-encoding; exceeds payload offset max size");
            require(_itemLength(item._unsafeMemPtr) == len, "Invalid RLP-encoding; implied item length must match encoded length");
            require(_validate(item), "Invalid RLP-encoding");
        }
        return item;
    }

    /**
     * @dev Checks whether the RLP item is null
     * @param self The RLP item
     * @return True, if the item is null
     */
    function isNull(RLPItem memory self)
        internal
        pure
        returns (bool ret)
    {
        return self._unsafeLength == 0;
    }

    /**
     * @dev Checks whether the RLP item is a list
     * @param self The RLP item
     * @return True, if the item is a list
     */
    function isList(RLPItem memory self)
        internal
        pure
        returns (bool ret)
    {
        if (self._unsafeLength == 0) {
            return false;
        }
        uint memPtr = self._unsafeMemPtr;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            ret := iszero(lt(byte(0, mload(memPtr)), 0xC0))
        }
    }

    /**
     * @dev Checks whether the RLP item is data
     * @param self The RLP item
     * @return True, if the item is data
     */
    function isData(RLPItem memory self)
        internal
        pure
        returns (bool ret)
    {
        if (self._unsafeLength == 0) {
            return false;
        }
        uint memPtr = self._unsafeMemPtr;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            ret := lt(byte(0, mload(memPtr)), 0xC0)
        }
    }

    /**
     * @dev Checks whether the RLP item is empty (string or list)
     * @param self The RLP item
     * @return True, if the item is null
     */
    function isEmpty(RLPItem memory self)
        internal
        pure
        returns (bool ret)
    {
        if (isNull(self)) {
            return false;
        }
        uint b0;
        uint memPtr = self._unsafeMemPtr;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            b0 := byte(0, mload(memPtr))
        }
        return (b0 == DATA_SHORT_START || b0 == LIST_SHORT_START);
    }

    /**
     * @dev Retrieves the number of items in an RLP-encoded list
     * @param self The RLP item
     * @return The number of items
     */
    function items(RLPItem memory self)
        internal
        pure
        returns (uint)
    {
        if (!isList(self)) {
            return 0;
        }
        uint b0;
        uint memPtr = self._unsafeMemPtr;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            b0 := byte(0, mload(memPtr))
        }
        uint pos = memPtr + _payloadOffset(self);
        uint last = memPtr + self._unsafeLength - 1;
        uint itms;
        while (pos <= last) {
            pos += _itemLength(pos);
            itms++;
        }
        return itms;
    }

    /**
     * @dev Create an iterator
     * @param self The RLP item
     * @return An 'Iterator' over the item
     */
    function iterator(RLPItem memory self)
        internal
        pure
        returns (Iterator memory it)
    {
        require(isList(self), "Item must be a list");
        uint ptr = self._unsafeMemPtr + _payloadOffset(self);
        it._unsafeItem = self;
        it._unsafeNextPtr = ptr;
    }

    /**
     * @dev Decode an RLPItem into bytes. Works only if the RLPItem is not a list.
     * @param self The RLPItem
     * @return The decoded string
     */
    function toData(RLPItem memory self)
        internal
        pure
        returns (bytes memory bts)
    {
        require(isData(self), "Item must be data");
        uint rStartPos;
        uint len;
        (rStartPos, len) = _decode(self);
        bts = new bytes(len);
        _copyToBytes(rStartPos, bts, len);
    }

    /**
     * @dev Retrieves the list of sub-items from an RLP-encoded list
     * Warning: This is inefficient because it requires that the list is read twice
     * @param self The RLP item
     * @return Array of RLPItems
     */
    function toList(RLPItem memory self)
        internal
        pure
        returns (RLPItem[] memory list)
    {
        require(isList(self), "Item must be a list");
        uint numItems = items(self);
        list = new RLPItem[](numItems);
        Iterator memory it = iterator(self);
        uint idx;
        while (_hasNext(it)) {
            list[idx] = _next(it);
            idx++;
        }
    }

    /**
     * @dev Decode an RLPItem into an ascii string. Works only when the RLPItem is not a list.
     * @param self The RLPItem
     * @return The decoded string
     */
    function toAscii(RLPItem memory self)
        internal
        pure
        returns (string memory str)
    {
        require(isData(self), "Must be RLP-encoded bytes");
        uint rStartPos;
        uint len;
        (rStartPos, len) = _decode(self);
        bytes memory bts = new bytes(len);
        _copyToBytes(rStartPos, bts, len);
        str = string(bts);
    }

    /**
     * @dev Decode an RLPItem into a uint. Works only if the RLPItem is not a list.
     * @param self The RLPItem
     * @return The decoded string
     */
    function toUint(RLPItem memory self)
        internal
        pure
        returns (uint data)
    {
        require(isData(self), "Must be RLP-encoded bytes");
        uint rStartPos;
        uint len;
        (rStartPos, len) = _decode(self);
        require(len <= 32, "Must be RLP-encoded bytes32");
        // solhint-disable-next-line no-inline-assembly
        assembly {
            data := div(mload(rStartPos), exp(256, sub(32, len)))
        }
    }

    /**
     * @dev Decode an RLPItem into a boolean. Works only if the RLPItem is not a list.
     * @param self The RLPItem
     * @return The decoded string
     */
    function toBool(RLPItem memory self)
        internal
        pure
        returns (bool data)
    {
        require(isData(self), "Must be RLP-encoded bytes");
        uint rStartPos;
        uint len;
        (rStartPos, len) = _decode(self);
        require(len == 1, "Must be RLP-encoded bytes");
        uint temp;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            temp := byte(0, mload(rStartPos))
        }
        require(temp <= 1, "Must be RLP-encoded bytes");
        return temp == 1 ? true : false;
    }

    /**
     * @dev Decode an RLPItem into a byte. Works only if the RLPItem is not a list.
     * @param self The RLPItem
     * @return The decoded string
     */
    function toByte(RLPItem memory self)
        internal
        pure
        returns (byte data)
    {
        require(isData(self), "Must be RLP-encoded bytes");
        uint rStartPos;
        uint len;
        (rStartPos, len) = _decode(self);
        require(len == 1, "Must be RLP-encoded bytes");
        uint temp;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            temp := byte(0, mload(rStartPos))
        }
        return byte(uint8(temp));
    }

    /**
     * @dev Decode an RLPItem into an int. Works only if the RLPItem is not a list.
     * @param self The RLPItem
     * @return The decoded string
     */
    function toInt(RLPItem memory self)
        internal
        pure
        returns (int data)
    {
        return int(toUint(self));
    }

    /**
     * @dev Decode an RLPItem into a bytes32. Works only if the RLPItem is not a list.
     * @param self The RLPItem
     * @return The decoded string
     */
    function toBytes32(RLPItem memory self)
        internal
        pure
        returns (bytes32 data)
    {
        return bytes32(toUint(self));
    }

    /**
     * @dev Decode an RLPItem into an address. Works only if the RLPItem is not a list.
     * @param self The RLPItem
     * @return The decoded string
     */
    function toAddress(RLPItem memory self)
        internal
        pure
        returns (address data)
    {
        require(isData(self), "Must be RLP-encoded bytes");
        uint rStartPos;
        uint len;
        (rStartPos, len) = _decode(self);
        require(len == 20, "Must be RLP-encoded bytes");
        // solhint-disable-next-line no-inline-assembly
        assembly {
            data := div(mload(rStartPos), exp(256, 12))
        }
    }

    /**
     * @dev Decode an RLPItem into a bytes20. Works only if the RLPItem is not a list.
     * @param self The RLPItem
     * @return The decoded string
     */
    function toBytes20(RLPItem memory self)
        internal
        pure
        returns (bytes20 data)
    {
        return bytes20(toAddress(self));
    }

    /*
     * Private functions
     */
    /**
     * @dev Returns the next RLP item for an iterator
     * @param self The iterator
     * @return The next RLP item
     */
    function _next(Iterator memory self)
        private
        pure
        returns (RLPItem memory subItem)
    {
        require(_hasNext(self), "Must be RLP-encoded bytes");
        uint ptr = self._unsafeNextPtr;
        uint itemLength = _itemLength(ptr);
        subItem._unsafeMemPtr = ptr;
        subItem._unsafeLength = itemLength;
        self._unsafeNextPtr = ptr + itemLength;
    }

    /**
     * @dev Returns the next RLP item for an iterator, and validates it.
     * @param self The iterator
     * @return The next RLP item
     */
    function _next(Iterator memory self, bool strict)
        private
        pure
        returns (RLPItem memory subItem)
    {
        subItem = _next(self);
        require(!strict || _validate(subItem), "Must be RLP-encoded bytes");
        return subItem;
    }

    /**
     * @dev Checks whether an iterator has a next RLP item
     * @param self The iterator
     * @return True, if the iterator has an RLP item; otherwise, False
     */
    function _hasNext(Iterator memory self)
        private
        pure
        returns (bool)
    {
        RLPItem memory item = self._unsafeItem;
        return self._unsafeNextPtr < item._unsafeMemPtr + item._unsafeLength;
    }

    /**
     * @dev Determines the payload offset of a specified RLP item
     * @param self The RLP item to query
     * @return The payload offset for the RLP item
     */
    function _payloadOffset(RLPItem memory self)
        private
        pure
        returns (uint)
    {
        if (self._unsafeLength == 0) {
            return 0;
        }
        uint b0;
        uint memPtr = self._unsafeMemPtr;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            b0 := byte(0, mload(memPtr))
        }
        if (b0 < DATA_SHORT_START) {
            return 0;
        }
        if (b0 < DATA_LONG_START || (b0 >= LIST_SHORT_START && b0 < LIST_LONG_START)) {
            return 1;
        }
        if (b0 < LIST_SHORT_START) {
            return b0 - DATA_LONG_OFFSET + 1;
        }
        return b0 - LIST_LONG_OFFSET + 1;
    }

    /**
     * @dev Determines the length of a specified RLP item
     * @param memPtr Pointer to the start of the RLP item
     * @return Length of the RLP item
     */
    function _itemLength(uint memPtr)
        private
        pure
        returns (uint len)
    {
        uint b0;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            b0 := byte(0, mload(memPtr))
        }
        if (b0 < DATA_SHORT_START) {
            len = 1;
        } else if (b0 < DATA_LONG_START) {
            len = b0 - DATA_SHORT_START + 1;
        } else if (b0 < LIST_SHORT_START) {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                let bLen := sub(b0, 0xB7) // bytes length (DATA_LONG_OFFSET)
                let dLen := div(mload(add(memPtr, 1)), exp(256, sub(32, bLen))) // data length
                len := add(1, add(bLen, dLen)) // total length
            }
        } else if (b0 < LIST_LONG_START) {
            len = b0 - LIST_SHORT_START + 1;
        } else {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                let bLen := sub(b0, 0xF7) // bytes length (LIST_LONG_OFFSET)
                let dLen := div(mload(add(memPtr, 1)), exp(256, sub(32, bLen))) // data length
                len := add(1, add(bLen, dLen)) // total length
            }
        }
    }

    /**
     * @dev Determines the start position and length of a specified RLP item
     * @param self The RLP item to query
     * @return A pointer to the beginning of the RLP item, and its length
     */
    function _decode(RLPItem memory self)
        private
        pure
        returns (uint memPtr, uint len)
    {
        require(isData(self), "These are not RLP-encoded bytes");
        uint b0;
        uint start = self._unsafeMemPtr;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            b0 := byte(0, mload(start))
        }
        if (b0 < DATA_SHORT_START) {
            return (start, 1);
        }
        if (b0 < DATA_LONG_START) {
            len = self._unsafeLength - 1;
            memPtr = start + 1;
        } else {
            uint bLen;
            // solhint-disable-next-line no-inline-assembly
            assembly {
                bLen := sub(b0, 0xB7) // DATA_LONG_OFFSET
            }
            len = self._unsafeLength - 1 - bLen;
            memPtr = start + bLen + 1;
        }
        return (memPtr, len);
    }

    /**
     * @dev Copies a subset of data to a specified target
     * @param btsPtr Pointer to the data to copy
     * @param tgt Target destination for copied data
     * @param btsLen Number of bytes to copy
     */
    function _copyToBytes(uint btsPtr, bytes memory tgt, uint btsLen)
        private
        pure
    {
        // Exploiting the fact that 'tgt' was the last thing to be allocated,
        // we can write entire words, and overwrite any excess.
        // solhint-disable-next-line no-inline-assembly
        assembly {
            {
                let i := 0
                let words := div(add(btsLen, 31), 32)
                let rOffset := btsPtr
                let wOffset := add(tgt, 0x20)
                for { } lt(i, words) { } {
                    let offset := mul(i, 0x20)
                    mstore(add(wOffset, offset), mload(add(rOffset, offset)))
                    i := add(i, 1)
                }
                mstore(add(tgt, add(0x20, mload(tgt))), 0)
            }
        }
    }

    /**
     * @dev Checks the validity of a specified RLP item
     * @param self The RLP item to validate
     * @return True, if the RLP item is well-formed; otherwise, False
     */
    function _validate(RLPItem memory self)
        private
        pure
        returns (bool ret)
    {
        // Checks that a specified RLP is well-formed
        uint b0;
        uint b1;
        uint memPtr = self._unsafeMemPtr;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            b0 := byte(0, mload(memPtr))
            b1 := byte(1, mload(memPtr))
        }
        if (b0 == DATA_SHORT_START + 1 && b1 < DATA_SHORT_START) {
            return false;
        }
        return true;
    }
}
