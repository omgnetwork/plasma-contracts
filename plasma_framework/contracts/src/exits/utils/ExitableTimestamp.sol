pragma solidity 0.5.11;

import "openzeppelin-solidity/contracts/math/Math.sol";

library ExitableTimestamp {
    struct Calculator {
        uint256 minExitPeriod;
    }

    function calculateDepositTxOutputExitableTimestamp(
        Calculator memory _calculator,
        uint256 _now
    )
        internal
        pure
        returns (uint64)
    {
        // Please that boosting the exitable timestamp for a deposit should be only done in case of a SE.
        // For the explanation please refer to: https://github.com/omisego/plasma-contracts/issues/216
        return uint64(_now + _calculator.minExitPeriod);
    }

    function calculateTxExitableTimestamp(
        Calculator memory _calculator,
        uint256 _now,
        uint256 _blockTimestamp
    )
        internal 
        pure
        returns (uint64)
    {
        return uint64(Math.max(_blockTimestamp + (_calculator.minExitPeriod * 2), _now + _calculator.minExitPeriod));
    }
}
