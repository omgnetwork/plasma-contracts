pragma solidity ^0.5.0;

/**
 * @notice Stores an updateable bond size.
 * @dev Design of the bond: https://github.com/omisego/research/issues/107#issuecomment-525267486
 * @dev Security relies on the min/max value that can be updated to compare to current bond size plus the waiting period.
 *      The min/max value of the next bond size prevent the possibility to update to an insane high/low bond that breaks the system.
 *      The waiting period ensures that a user does not get an unexpected bond without notice.
 */
library BondSize {
    uint64 constant public WAITING_PERIOD = 2 days;

    /**
     * @dev Struct is designed to be packed into two 32-bytes storage slots
     * @param previousBondSize the bond size before upgrade. Should be kept before the waiting period has passed
     * @param updatedBondSize the bond size that should be used after the waiting period has passed
     * @param effectiveUpdateTime the timestamp when the waiting period has passwd and the updated bond size takes effect
     * @param lowerBoundDivisor the divisor used to check the lower bound for an update. Each update cannot be lower than (current bond / lowerBoundDivisor)
     * @param upperBoundMultiplier the multiplier used to check the upper bound for an update. Each update cannot be larger than (current bond * upperBoundMultiplier)
     */
    struct Params {
        uint128 previousBondSize;
        uint128 updatedBondSize;
        uint128 effectiveUpdateTime;
        uint16 lowerBoundDivisor;
        uint16 upperBoundMultiplier;
    }

    function buildParams(uint128 _initialBondSize, uint16 _lowerBoundDivisor, uint16 _upperBoundMultiplier)
        internal
        pure
        returns (Params memory)
    {
        // Set the initial value to far in the future
        uint128 initialEffectiveUpdateTime = 2 ** 63;
        return Params({
            previousBondSize: _initialBondSize,
            updatedBondSize: 0,
            effectiveUpdateTime: initialEffectiveUpdateTime,
            lowerBoundDivisor: _lowerBoundDivisor,
            upperBoundMultiplier: _upperBoundMultiplier
        });
    }

    /**
    * @notice Updates the bond size.
    * @notice The new value is bounded by 0.5 and 2x of current bond size.
    * @notice There is a waiting period of 2 days before the new value goes into effect.
    * @param newBondSize the new bond size.
    */
    function updateBondSize(Params storage _self, uint128 newBondSize) internal {
        validateBondSize(_self, newBondSize);

        if (_self.updatedBondSize != 0 && now > _self.effectiveUpdateTime) {
            _self.previousBondSize = _self.updatedBondSize;
        }
        _self.updatedBondSize = newBondSize;
        _self.effectiveUpdateTime = uint64(now) + WAITING_PERIOD;
    }

    /**
    * @notice Returns the current bond size.
    */
    function bondSize(Params memory _self) internal view returns (uint128) {
        if (now < _self.effectiveUpdateTime) {
            return _self.previousBondSize;
        } else {
            return _self.updatedBondSize;
        }
    }

    function validateBondSize(Params memory _self, uint128 newBondSize) private view {
        uint128 currentBondSize = bondSize(_self);
        require(newBondSize >= currentBondSize / _self.lowerBoundDivisor, "Bond size is too low");
        require(newBondSize <= currentBondSize * _self.upperBoundMultiplier, "Bond size is too high");
    }
}
