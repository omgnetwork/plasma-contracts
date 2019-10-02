pragma solidity 0.5.11;

import "../../src/utils/OnlyWithValue.sol";

contract OnlyWithValueMock is OnlyWithValue {
    event OnlyWithValuePassed();

    function checkOnlyWithValue(uint256 _value) public payable onlyWithValue(_value) {
        emit OnlyWithValuePassed();
    }
}
