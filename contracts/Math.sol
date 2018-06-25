pragma solidity ^0.4.0;

library Math {
    /*
     * Internal functions
     */


    /**
     * @dev Returns the greater of two integers.
     * @param _a First integer.
     * @param _b Second integer.
     * @return Greater of the two.
     */
    function max(uint256 _a, uint256 _b)
        internal
        pure
        returns (uint256) 
    {
        return _a >= _b ? _a : _b;
    }
}
