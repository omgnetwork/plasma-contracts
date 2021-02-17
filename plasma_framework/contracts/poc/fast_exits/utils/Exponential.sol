pragma solidity 0.5.11;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/**
 * Credit: Derived from Compound's Exponential contract
 */
contract Exponential {
    using SafeMath for uint256;

    uint256 constant private expScale = 1e18;

    struct Exp {
        uint256 mantissa;
    }

    /**
     * @dev Creates an exponential from numerator and denominator values
     */
    function getExp(uint256 num, uint256 denom) pure internal returns (Exp memory) {
        uint256 scaledNumerator = num.mul(expScale);

        uint256 rational = scaledNumerator.div(denom);

        return (Exp({mantissa: rational}));
    }

    /**
     * @dev Multiply an Exp by a scalar, returning a new Exp.
     */
    function mulScalar(Exp memory a, uint256 scalar) pure internal returns (Exp memory) {
        uint256 scaledMantissa = a.mantissa.mul(scalar);

        return (Exp({mantissa: scaledMantissa}));
    }

    /**
     * @dev Multiply an Exp by a scalar, then truncate to return an unsigned integer.
     */
    function mulScalarTruncate(Exp memory a, uint256 scalar) pure internal returns (uint) {
        Exp memory product = mulScalar(a, scalar);

        return (truncate(product));
    }

    /**
     * @dev Divide a scalar by an Exp, returning a new Exp.
     */
    function divScalarByExp(uint256 scalar, Exp memory divisor) pure internal returns (Exp memory) {
        uint numerator = expScale.mul(scalar);

        return getExp(numerator, divisor.mantissa);
    }

    /**
     * @dev Divide a scalar by an Exp, then truncate to return an unsigned integer.
     */
    function divScalarByExpTruncate(uint scalar, Exp memory divisor) pure internal returns (uint) {
        Exp memory fraction = divScalarByExp(scalar, divisor);

        return (truncate(fraction));
    }

    /**
     * @dev Truncates the given exp to a whole number value.
     *      For example, truncate(Exp{mantissa: 15 * expScale}) = 15
     */
    function truncate(Exp memory exp) pure internal returns (uint) {
        return exp.mantissa / expScale;
    }

}
