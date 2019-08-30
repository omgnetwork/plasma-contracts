pragma solidity ^0.5.0;

/**
 * @notice Stores an updateable bond size.
 */
library BondSize {
    uint256 constant public WAITING_PERIOD = 2 days;

    struct Params {
        uint128 previousBondSize;
        uint128 updatedBondSize;
        uint256 waitingPeriod;
    }

    function buildParams(uint128 _initialBondSize) internal pure returns (Params memory) {
        return Params({
            previousBondSize: _initialBondSize,
            updatedBondSize: 0,
            waitingPeriod: 2 ** 255 // Initial waiting period is far in the future
        });
    }

    /**
    * @notice Updates the bond size.
    * @notice The new value is bounded by 0.5 and 2x of current bond size.
    * @notice There is a waiting period of 2 days before the new value goes into effect.
    * @param newBondSize the new bond size.
    */
    function updateBondSize(Params storage _self, uint128 newBondSize) internal {
        validateBondSize(newBondSize, bondSize(_self));

        if (_self.updatedBondSize != 0 && now > _self.waitingPeriod) {
            _self.previousBondSize = _self.updatedBondSize;
        }
        _self.updatedBondSize = newBondSize;
        _self.waitingPeriod = now + WAITING_PERIOD;
    }

    /**
    * @notice Returns the current bond size.
    */
    function bondSize(Params memory _self) internal view returns (uint256) {
        if (now < _self.waitingPeriod) {
            return _self.previousBondSize;
        } else {
            return _self.updatedBondSize;
        }
    }

    function validateBondSize(uint256 newBondSize, uint256 currentBondSize) private pure {
        require(newBondSize >= currentBondSize / 2, "Bond size is too low");
        require(newBondSize <= currentBondSize * 2, "Bond size is too high");
    }
}
