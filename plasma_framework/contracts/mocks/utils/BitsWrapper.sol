pragma solidity 0.5.11;

import "../../src/utils/Bits.sol";

contract BitsWrapper {
    function setBit(uint _self, uint8 _index) public pure returns (uint)
    {
        return Bits.setBit(_self, _index);
    }

    function clearBit(uint _self, uint8 _index) public pure returns (uint)
    {
        return Bits.clearBit(_self, _index);
    }

    /**
     * @dev It makes sense to expose just `bitSet` to be able to test both of Bits `getBit` and `bitSet`
     */
    function bitSet(uint _self, uint8 _index) public pure returns (bool)
    {
        return Bits.bitSet(_self, _index);
    }
}
