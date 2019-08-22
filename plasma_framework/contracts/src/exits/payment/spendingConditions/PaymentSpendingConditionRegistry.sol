pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./IPaymentSpendingCondition.sol";

contract PaymentSpendingConditionRegistry is Ownable {
    mapping(bytes32 => IPaymentSpendingCondition) private _spendingConditions;

    function spendingConditions(uint256 _outputType, uint256 _spendingTxType)
        public
        view
        returns (IPaymentSpendingCondition)
    {
        bytes32 key = keccak256(abi.encodePacked(_outputType, _spendingTxType));
        return _spendingConditions[key];
    }

    /**
     * @notice Register the spending condition.
     * @dev output type with 0 is allowed but spending tx type should not be 0 (by design of tx type)
     * @param _outputType output type that the parser is registered with.
     * @param _spendingTxType output type that the parser is registered with.
     * @param _address Address of the spending condition contract.
     */
    function registerSpendingCondition(uint256 _outputType, uint256 _spendingTxType, address _address)
        public
        onlyOwner
    {
        require(_spendingTxType != 0, "Transaction Type must not be 0");
        require(_address != address(0), "Should not register an empty address");

        bytes32 key = keccak256(abi.encodePacked(_outputType, _spendingTxType));
        require(address(_spendingConditions[key]) == address(0),
                "This (output type, spending tx type) pair has already been registered");

        _spendingConditions[key] = IPaymentSpendingCondition(_address);
    }
}
