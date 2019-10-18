pragma solidity 0.5.11;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../interfaces/ISpendingCondition.sol";

/**
 * @title SpendingConditionRegistry
 * @notice The registry contracts of the spending condition
 * @dev This is designed to renounce ownership before injecting the registry contract to ExitGame contracts
 *      After registering all the essential condition contracts, the owner should renounce its ownership to
 *      ensure no further conditions are registered for an ExitGame contract.
 *      https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/ownership/Ownable.sol#L55
 */
contract SpendingConditionRegistry is Ownable {
    // mapping of hash(outputType, spendingTxTpye) => ISpendingCondition
    mapping(bytes32 => ISpendingCondition) internal _spendingConditions;

    function spendingConditions(uint256 outputType, uint256 spendingTxType) public view returns (ISpendingCondition) {
        bytes32 key = keccak256(abi.encode(outputType, spendingTxType));
        return _spendingConditions[key];
    }

    /**
     * @notice Register the spending condition contract
     * @param outputType The output type of the spending condition
     * @param spendingTxType Spending tx type of the spending condition
     * @param condition The spending condition contract
     */
    function registerSpendingCondition(uint256 outputType, uint256 spendingTxType, ISpendingCondition condition)
        public
        onlyOwner
    {
        require(outputType != 0, "Registration not possible with output type 0");
        require(spendingTxType != 0, "Registration not possible with spending tx type 0");
        require(address(condition) != address(0), "Registration not possible with an empty address");

        bytes32 key = keccak256(abi.encode(outputType, spendingTxType));
        require(address(_spendingConditions[key]) == address(0), "The (output type, spending tx type) pair is already registered");

        _spendingConditions[key] = condition;
    }
}
