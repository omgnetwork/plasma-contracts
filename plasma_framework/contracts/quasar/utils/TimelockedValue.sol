pragma solidity 0.5.11;

/**
 * @notice Stores a value that can only be updated after a waiting period 
 */
library TimelockedValue {
    uint64 constant public WAITING_PERIOD = 7 days;

    /**
     * @param previousValue The value prior to upgrade, which should remain the same until the waiting period completes
     * @param updatedValue The value to use once the waiting period completes
     * @param effectiveUpdateTime A timestamp for the end of the waiting period, when the updated value comes into effect
     */
    struct Params {
        uint64 previousValue;
        uint64 updatedValue;
        uint128 effectiveUpdateTime;
    }

    function buildParams(uint64 initialValue)
        internal
        pure
        returns (Params memory)
    {
        // Set the initial value far into the future
        uint128 initialEffectiveUpdateTime = 2 ** 63;
        return Params({
            previousValue: initialValue,
            updatedValue: initialValue,
            effectiveUpdateTime: initialEffectiveUpdateTime
        });
    }

    /**
    * @notice Updates the value
    * @dev The new value comes into effect once the waiting period completes
    * @param newValue The new value
    */
    function updateValue(Params storage self, uint64 newValue) internal {
        if (now >= self.effectiveUpdateTime) {
            self.previousValue = self.updatedValue;
        }
        self.updatedValue = newValue;
        self.effectiveUpdateTime = uint64(now) + WAITING_PERIOD;
    }

    /**
    * @notice Returns the current value
    */
    function getValue(Params memory self) internal view returns (uint64) {
        if (now < self.effectiveUpdateTime) {
            return self.previousValue;
        } else {
            return self.updatedValue;
        }
    }
}
