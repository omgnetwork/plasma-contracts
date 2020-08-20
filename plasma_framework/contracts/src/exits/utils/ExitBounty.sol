pragma solidity 0.5.11;

/**
 * @notice Stores an updateable exit bounty size
 * @dev See https://github.com/omgnetwork/plasma-contracts/issues/658 for discussion about size
 */
library ExitBounty {
    uint64 constant public WAITING_PERIOD = 2 days;

    /**
     * @param previousExitBountySize The exit bounty size prior to upgrade, which should remain the same until the waiting period completes
     * @param updatedExitBountySize The exit bounty size to use once the waiting period completes
     * @param effectiveUpdateTime A timestamp for the end of the waiting period, when the updated exit bounty size is implemented
     * @param lowerBoundDivisor The divisor that checks the lower bound for an update. Each update cannot be lower than (current bounty / lowerBoundDivisor)
     * @param upperBoundMultiplier The multiplier that checks the upper bound for an update. Each update cannot be larger than (current bounty * upperBoundMultiplier)
     */
    struct Params {
        uint128 previousExitBountySize;
        uint128 updatedExitBountySize;
        uint128 effectiveUpdateTime;
        uint16 lowerBoundDivisor;
        uint16 upperBoundMultiplier;
    }

    function buildParams(uint128 initialExitBountySize, uint16 lowerBoundDivisor, uint16 upperBoundMultiplier)
        internal
        pure
        returns (Params memory)
    {
        // Set the initial value far into the future
        uint128 initialEffectiveUpdateTime = 2 ** 63;
        return Params({
            previousExitBountySize: initialExitBountySize,
            updatedExitBountySize: 0,
            effectiveUpdateTime: initialEffectiveUpdateTime,
            lowerBoundDivisor: lowerBoundDivisor,
            upperBoundMultiplier: upperBoundMultiplier
        });
    }

    /**
    * @notice Updates the Exit Bounty size
    * @dev The new bounty size value updates once the two day waiting period completes
    * @param newExitBountySize The new bounty size
    */
    function updateExitBountySize(Params storage self, uint128 newExitBountySize) internal {
        validateExitBountySize(self, newExitBountySize);

        if (self.updatedExitBountySize != 0 && now >= self.effectiveUpdateTime) {
            self.previousExitBountySize = self.updatedExitBountySize;
        }
        self.updatedExitBountySize = newExitBountySize;
        self.effectiveUpdateTime = uint64(now) + WAITING_PERIOD;
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

    function validateExitBountySize(Params memory self, uint128 newExitBountySize) private view {
        uint128 currentExitBountySize = exitBountySize(self);
        require(newExitBountySize > 0, "Bounty size cannot be zero");
        require(newExitBountySize >= currentExitBountySize / self.lowerBoundDivisor, "Bounty size is too low");
        require(uint256(newExitBountySize) <= uint256(currentExitBountySize) * self.upperBoundMultiplier, "Bounty size is too high");
    }

}
