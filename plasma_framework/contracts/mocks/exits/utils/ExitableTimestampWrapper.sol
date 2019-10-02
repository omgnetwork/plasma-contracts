pragma solidity 0.5.11;

import "../../../src/exits/utils/ExitableTimestamp.sol";

contract ExitableTimestampWrapper {
    using ExitableTimestamp for ExitableTimestamp.Calculator;
    ExitableTimestamp.Calculator internal calculator;

    constructor(uint256 _minExitPeriod) public {
        calculator = ExitableTimestamp.Calculator(_minExitPeriod);
    }

    function calculate(uint256 _now, uint256 _blockTimestamp, bool _isDeposit)
        public
        view
        returns (uint256)
    {
        return calculator.calculate(_now, _blockTimestamp, _isDeposit);
    }
}
