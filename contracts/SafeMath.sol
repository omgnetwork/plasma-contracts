pragma solidity ^0.4.0;


/**
 * @title SafeMath
 * @dev Math operations with safety checks that throw an error.
 * Based off of https://github.com/OpenZeppelin/openzeppelin-solidity/blob/master/contracts/math/SafeMath.sol.
 */
library SafeMath {
    /*
     * Internal functions
     */

    function mul(uint256 a, uint256 b)
        internal
        pure
        returns (uint256)
    {
        if (a == 0) {
            return 0;
        }
        uint256 c = a * b;
        assert(c / a == b);
        return c;
    }

    function div(uint256 a, uint256 b)
        internal
        pure
        returns (uint256)
    {
        uint256 c = a / b;
        return c;
    }

    function sub(uint256 a, uint256 b)
        internal
        pure
        returns (uint256) 
    {
        assert(b <= a);
        return a - b;
    }

    function add(uint256 a, uint256 b)
        internal
        pure
        returns (uint256) 
    {
        uint256 c = a + b;
        assert(c >= a);
        return c;
    }
}
