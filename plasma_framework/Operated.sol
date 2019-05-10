pragma solidity ^0.4.0;

contract Operated {
    address public operator;

    modifier onlyOperator() {
        require(msg.sender == operator);
        _;
    }

    function _initOperator()
        internal
    {
        require(operator == address(0));
        operator = msg.sender;
    }
}