pragma solidity 0.5.11;

/**
 * @notice Stores an updateable bond size
 * @dev Bond design details at https://github.com/omisego/research/issues/107#issuecomment-525267486
 * @dev Security depends on the min/max value, which can be updated to compare to the current bond size, plus the waiting period
 *      Min/max value of the next bond size prevents the possibility to set bond size too low or too high, which risks breaking the system
 *      Waiting period ensures that a user does not get an unexpected bond without notice.
 * @dev Exit Bounty size discussions https://github.com/omgnetwork/plasma-contracts/issues/658
 */
library BondSize {
    uint64 constant public WAITING_PERIOD = 2 days;

    /**
     * @dev Struct is designed to be packed into two 32-bytes storage slots
     * @param previousBondSize The bond size prior to upgrade, which should remain the same until the waiting period completes
     * @param updatedBondSize The bond size to use once the waiting period completes
     * @param previousExitBountySize The exit bounty size prior to upgrade, which should remain the same until the waiting period completes
     * @param updatedExitBountySize The exit bounty size to use once the waiting period completes
     * @param effectiveUpdateTime A timestamp for the end of the waiting period, when the updated bond size is implemented
     * @param lowerBoundDivisor The divisor that checks the lower bound for an update. Each update cannot be lower than (current bond / lowerBoundDivisor)
     * @param upperBoundMultiplier The multiplier that checks the upper bound for an update. Each update cannot be larger than (current bond * upperBoundMultiplier)
     */
    struct Params {
        uint128 previousBondSize;
        uint128 updatedBondSize;
        uint128 previousExitBountySize;
        uint128 updatedExitBountySize;
        uint128 effectiveUpdateTime;
        uint16 lowerBoundDivisor;
        uint16 upperBoundMultiplier;
    }

    function buildParams(uint128 initialBondSize, uint128 initialExitBountySize, uint16 lowerBoundDivisor, uint16 upperBoundMultiplier)
        internal
        pure
        returns (Params memory)
    {
        require(initialBondSize >= initialExitBountySize, "The Bond size should be greater than or equal to the Bounty");
        // Set the initial value far into the future
        uint128 initialEffectiveUpdateTime = 2 ** 63;
        return Params({
            previousBondSize: initialBondSize,
            updatedBondSize: 0,
            previousExitBountySize: initialExitBountySize,
            updatedExitBountySize: 0,
            effectiveUpdateTime: initialEffectiveUpdateTime,
            lowerBoundDivisor: lowerBoundDivisor,
            upperBoundMultiplier: upperBoundMultiplier
        });
    }

    /**
    * @notice Updates the bond size
    * @dev The new bond size value updates once the two day waiting period completes
    * @param newBondSize The new bond size
    * @param newExitBountySize The new exit bounty size
    */
    function updateBondSize(Params storage self, uint128 newBondSize, uint128 newExitBountySize) internal {
        validateBondSize(self, newBondSize, newExitBountySize);

        if (self.updatedBondSize != 0 && now >= self.effectiveUpdateTime) {
            self.previousBondSize = self.updatedBondSize;
            self.previousExitBountySize = self.updatedExitBountySize;
        }
        self.updatedBondSize = newBondSize;
        self.updatedExitBountySize = newExitBountySize;
        self.effectiveUpdateTime = uint64(now) + WAITING_PERIOD;
    }

    /**
    * @notice Returns the current bond size
    */
    function bondSize(Params memory self) internal view returns (uint128) {
        if (now < self.effectiveUpdateTime) {
            return self.previousBondSize;
        } else {
            return self.updatedBondSize;
        }
    }

    /**
    * @notice Returns the current exit bounty size
    */
    function exitBountySize(Params memory self) internal view returns (uint128) {
        if (now < self.effectiveUpdateTime) {
            return self.previousExitBountySize;
        } else {
            return self.updatedExitBountySize;
        }
    }

    function validateBondSize(Params memory self, uint128 newBondSize, uint128 newExitBountySize) private view {
        require(newBondSize >= newExitBountySize, "The Bond size should be greater than or equal to the Bounty");
        uint128 currentBondSize = bondSize(self);
        require(newBondSize > 0, "Bond size cannot be zero");
        require(newBondSize >= currentBondSize / self.lowerBoundDivisor, "Bond size is too low");
        require(uint256(newBondSize) <= uint256(currentBondSize) * self.upperBoundMultiplier, "Bond size is too high");
    }
}
