pragma solidity 0.5.11;

contract OnlyWithValue {
    modifier onlyWithValue(uint256 _value) {
        require(msg.value == _value, "Input value mismatches with msg.value");
        _;
    }
}
