pragma solidity 0.5.11;

/**
 * @notice Stores an updateable bond size.
 */
library BondSize {
    uint64 constant public WAITING_PERIOD = 2 days;

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
        return Params({
            previousBondSize: _initialBondSize,
            updatedBondSize: 0,
            effectiveUpdateTime: 2 ** 63, // Initial waiting period is far in the future
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
