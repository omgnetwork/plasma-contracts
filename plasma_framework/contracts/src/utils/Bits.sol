pragma solidity 0.5.11;

/**
 * @title Bits
 * @dev Operations on individual bits of a word.
 */
library Bits {
    /*
     * Storage
     */

    uint constant internal ONE = uint(1);

    /*
     * Internal functions
     */
    /**
     * @dev Sets the bit at the given '_index' in '_self' to '1'.
     * @param _self Uint to modify.
     * @param _index Index of the bit to set.
     * @return The modified value.
     */
    function setBit(uint _self, uint8 _index)
        internal
        pure
        returns (uint)
    {
        return _self | ONE << _index;
    }

    /**
     * @dev Sets the bit at the given '_index' in '_self' to '0'.
     * @param _self Uint to modify.
     * @param _index Index of the bit to set.
     * @return The modified value.
     */
    function clearBit(uint _self, uint8 _index)
        internal
        pure
        returns (uint)
    {
        return _self & ~(ONE << _index);
    }

    /**
     * @dev Returns the bit at the given '_index' in '_self'.
     * @param _self Uint to check.
     * @param _index Index of the bit to get.
     * @return The value of the bit at '_index'.
     */
    function getBit(uint _self, uint8 _index)
        internal
        pure
        returns (uint8)
    {
        return uint8(_self >> _index & 1);
    }

    /**
     * @dev Checks if the bit at the given '_index' in '_self' is '1'.
     * @param _self Uint to check.
     * @param _index Index of the bit to check.
     * @return True if the bit is '0'. False otherwise.
     */
    function bitSet(uint _self, uint8 _index)
        internal
        pure
        returns (bool)
    {
        return getBit(_self, _index) == 1;
    }
}
