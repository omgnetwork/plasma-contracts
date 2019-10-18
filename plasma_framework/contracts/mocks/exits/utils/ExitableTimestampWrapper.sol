pragma solidity 0.5.11;

import "../../../src/exits/utils/ExitableTimestamp.sol";

contract ExitableTimestampWrapper {
    using ExitableTimestamp for ExitableTimestamp.Calculator;
    ExitableTimestamp.Calculator internal calculator;

    constructor(uint256 _minExitPeriod) public {
        calculator = ExitableTimestamp.Calculator(_minExitPeriod);
    }

    function calculateDepositTxOutputExitableTimestamp(
        uint256 _now
    )
        public
        view
        returns (uint64)
    {
        return calculator.calculateDepositTxOutputExitableTimestamp(_now);
    }

    function calculateTxExitableTimestamp(
        uint256 _now,
        uint256 _blockTimestamp
    )
        public
        view
        returns (uint64)
    {
        return calculator.calculateTxExitableTimestamp(_now, _blockTimestamp);
    }
}
