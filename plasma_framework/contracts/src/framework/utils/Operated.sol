pragma solidity ^0.5.0;

contract Operated {
    address public operator;

    /**
     * @notice Builing block exposes `onlyOperator` modifier to inheriting contracts.
     * @param plasmaOperator also known as Maintainer address that is allowed to register components
     * e.g. vaults, exit games in the framework. More https://github.com/omisego/plasma-contracts/issues/233
     */
    constructor(address plasmaOperator) public {
        require(plasmaOperator != address(0), "Operator cannot be zero-address.");
        operator = plasmaOperator;
    }

    modifier onlyOperator() {
        require(msg.sender == operator, "Not being called by operator");
        _;
    }
}
