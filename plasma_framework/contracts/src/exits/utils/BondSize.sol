pragma solidity ^0.5.0;

library BondSize {
    struct Params {
        uint128 previousBondSize;
        uint128 updatedBondSize;
        uint256 waitingPeriod;
    }

    function buildParams(uint128 _initialBondSize) internal pure returns (Params memory)
    {
        return Params({
            previousBondSize: _initialBondSize,
            updatedBondSize: 0,
            waitingPeriod: 2 ** 255
        });
    }

    function updateBondSize(Params storage _self, uint128 newBondSize) internal {
        validateBondSize(newBondSize, bondSize(_self));

        if (_self.updatedBondSize != 0 && now > _self.waitingPeriod) {
            _self.previousBondSize = _self.updatedBondSize;
        }
        _self.updatedBondSize = newBondSize;
        _self.waitingPeriod = now + 2 days;
    }

    function bondSize(Params memory _self) internal view returns (uint256) {
        if (now < _self.waitingPeriod) {
            return _self.previousBondSize;
        } else {
            return _self.updatedBondSize;
        }
    }

    function validateBondSize(uint256 newBondSize, uint256 currentBondSize) internal pure {
        require(newBondSize >= currentBondSize / 2, "Bond size too low");
        require(newBondSize <= currentBondSize * 2, "Bond size too high");
    }
}
