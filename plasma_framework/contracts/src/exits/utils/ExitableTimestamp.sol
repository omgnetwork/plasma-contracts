pragma solidity ^0.5.0;

import "../../framework/interfaces/IPlasmaFramework.sol";

import "openzeppelin-solidity/contracts/math/Math.sol";

library ExitableTimestamp {
    struct Calculator {
        uint256 minExitPeriod;
    }

    function calculate(
        Calculator memory _calculator,
        uint256 _now,
        uint256 _blockTimestamp,
        bool _isDeposit
    )
        internal
        pure
        returns (uint256)
    {
        uint256 minExitableTimestamp = _now + _calculator.minExitPeriod;

        if (_isDeposit) {
            return minExitableTimestamp;
        }
        return Math.max(_blockTimestamp + (_calculator.minExitPeriod * 2), minExitableTimestamp);
    }
}
