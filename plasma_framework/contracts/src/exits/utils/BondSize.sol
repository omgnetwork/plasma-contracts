pragma solidity 0.5.11;

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

    function buildParams(uint128 initialBondSize, uint16 lowerBoundDivisor, uint16 upperBoundMultiplier)
        internal
        pure
        returns (Params memory)
    {
        // Set the initial value to far in the future
        uint128 initialEffectiveUpdateTime = 2 ** 63;
        return Params({
            previousBondSize: initialBondSize,
            updatedBondSize: 0,
            effectiveUpdateTime: initialEffectiveUpdateTime,
            lowerBoundDivisor: lowerBoundDivisor,
            upperBoundMultiplier: upperBoundMultiplier
        });
    }

    /**
    * @notice Updates the bond size.
    * @dev There is a waiting period of 2 days before the new value goes into effect.
    * @param newBondSize the new bond size.
    */
    function updateBondSize(Params storage self, uint128 newBondSize) internal {
        validateBondSize(self, newBondSize);

        if (self.updatedBondSize != 0 && now > self.effectiveUpdateTime) {
            self.previousBondSize = self.updatedBondSize;
        }
        self.updatedBondSize = newBondSize;
        self.effectiveUpdateTime = uint64(now) + WAITING_PERIOD;
    }

    /**
    * @notice Returns the current bond size.
    */
    function bondSize(Params memory self) internal view returns (uint128) {
        if (now < self.effectiveUpdateTime) {
            return self.previousBondSize;
        } else {
            return self.updatedBondSize;
        }
    }

    function validateBondSize(Params memory self, uint128 newBondSize) private view {
        uint128 currentBondSize = bondSize(self);
        require(newBondSize > 0, "Bond size cannot be zero");
        require(newBondSize >= currentBondSize / self.lowerBoundDivisor, "Bond size is too low");
        require(uint256(newBondSize) <= uint256(currentBondSize) * self.upperBoundMultiplier, "Bond size is too high");
    }
}
