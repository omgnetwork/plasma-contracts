pragma solidity 0.5.11;

contract Operated {
    address private _operator;

    constructor() public {
        _operator = msg.sender;
    }

    modifier onlyOperator() {
        require(msg.sender == _operator, "Not called by the operator");
        _;
    }

    function operator() public view returns(address) {
        return _operator;
    }
}
