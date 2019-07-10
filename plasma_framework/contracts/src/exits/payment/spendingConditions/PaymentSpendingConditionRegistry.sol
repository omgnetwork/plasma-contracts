pragma solidity ^0.5.0;

import "./IPaymentSpendingCondition.sol";
import "../../../utils/Freezable.sol";
import "../../../framework/utils/Operated.sol";

contract PaymentSpendingConditionRegistry is Operated, Freezable {
    mapping(bytes32 => IPaymentSpendingCondition) private _spendingConditions;

    function spendingConditions(uint256 _outputType, uint256 _consumeTxType)
        public
        view
        returns (IPaymentSpendingCondition)
    {
        bytes32 key = keccak256(abi.encodePacked(_outputType, _consumeTxType));
        return _spendingConditions[key];
    }

    /**
     * @notice Register the spending condition.
     * @dev output type with 0 is allowed but consume tx type should not be 0
     * @param _outputType output type that the parser is registered with.
     * @param _consumeTxType output type that the parser is registered with.
     * @param _address Address of the spending condition contract.
     */
    function registerSpendingCondition(uint256 _outputType, uint256 _consumeTxType, address _address)
        public
        onlyOperator
        onlyNonFrozen
    {
        require(_consumeTxType != 0, "Should not register with consume tx type 0");
        require(_address != address(0), "Should not register an empty address");

        bytes32 key = keccak256(abi.encodePacked(_outputType, _consumeTxType));
        require(address(_spendingConditions[key]) == address(0),
                "The output type has already been registered");

        _spendingConditions[key] = IPaymentSpendingCondition(_address);
    }
}
