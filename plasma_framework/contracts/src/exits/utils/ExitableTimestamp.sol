pragma solidity 0.5.11;

import "openzeppelin-solidity/contracts/math/Math.sol";

library ExitableTimestamp {
    struct Calculator {
        uint256 minExitPeriod;
    }

    /**
     * @notice Calculates the exitable timestamp for a mined transaction
     * @dev This is the main function when asking for exitable timestamp in most cases.
     *      The only exception is to calculate the exitable timestamp for a deposit output in standard exit.
     *      Should use the function 'calculateDepositTxOutputExitableTimestamp' for that case.
     */
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

    /**
     * @notice Calculates the exitable timestamp for deposit transaction output for standard exit
     * @dev This function should only be used in standard exit for calculating exitable timestamp of a deposit output.
     *      For in-fight exit, the priority of a input tx which is a deposit tx should still be using the another function 'calculateTxExitableTimestamp'.
     *      See discussion here: https://git.io/Je4N5
     *      Reason of deposit output has different exitable timestamp: https://git.io/JecCV
     */
    function calculateDepositTxOutputExitableTimestamp(
        Calculator memory _calculator,
        uint256 _now
    )
        internal
        pure
        returns (uint64)
    {
        return uint64(_now + _calculator.minExitPeriod);
    }
}
