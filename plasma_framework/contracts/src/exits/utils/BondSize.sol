pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/math/SafeMath.sol';

/**
 * @notice Calculates bond size based on current average gas prices.
 * @dev An Exponentially Weighted Moving Average is used as it's cheap in terms of storage and resistant to sudden changes.
 * @dev `updateGasPrice()` must be called regularly to maintain the average gas price.
 */
library BondSize {
    using SafeMath for uint256;

    uint256 constant GWEI = 1000000000;

    /**
    * @param currentGasPrice The current average gas price.
    * @param targetGasCost The gas cost of the target method that can claim the bond (e.g. challenge).
    * @param ewmaFactor The 'smoothing' factor for the EWMA algorithm. Higher value means the the average changes more slowly.
    * @param safetyFactor Adjustment factor to multiply the bond size by. Value is a percentage i.e. 100 means unchanged.
    */
    struct Params {
        uint256 currentGasPrice;
        uint128 targetGasCost;
        uint64 ewmaFactor;
        uint64 safetyFactor;
    }

    /**
    * @notice Returns the bond size based on current gas prices.
    * @dev Rounds down to nearest gwei to avoid small changes in value.
    * @param _self Described in `Params` above.
    */
    function bondSize(Params memory _self) internal pure returns (uint256) {
        uint256 bond = _self.currentGasPrice
            .mul(uint256(_self.targetGasCost))
            .mul(uint256(_self.safetyFactor))
            .div(100);

        return bond.div(GWEI).mul(GWEI);
    }

    /**
    * @notice Updates the current gas price average.
    * @param _self Described in `Params` above.
    * @param _newGasPrice The new gas price to be included in the average.
    */
    function updateGasPrice(Params storage _self, uint256 _newGasPrice) internal {
        _self.currentGasPrice = ewma(_self.currentGasPrice, _newGasPrice, _self.ewmaFactor);
    }

    /**
    * @notice Calculates the Exponentially Weighted Moving Average.
    * @param _avg The current average.
    * @param _value The new value to be included.
    * @param _factor The weighting factor.
    */
    function ewma(uint256 _avg, uint256 _value, uint256 _factor) private pure returns (uint) {
        return _avg.mul(_factor - 1).add(_value).div(_factor);
    }
}
