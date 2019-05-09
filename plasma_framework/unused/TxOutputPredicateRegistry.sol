pragma solidity ^0.4.0;

import "./TxOutputPredicateInterface.sol";

contract TxOutputPredicateRegistry {
    /**
     * @dev Register an app to the MoreVp Plasma framework. This can be only called by contract admin.
     * @param _txoutType txout type that uses the predicate.
     * @param _consumeTxType tx type of the consume tx.
     * @param _contractAddress Address of the app contract.
     * @param _version version of the contract.
     */
    function registerTxOutputPredicate(uint256 _txoutType, uint256 _consumeTxType, address _contractAddress, uint256 _version) external;

    function getTxoutPredicateByVersion(uint256 _txoutType, uint256 _consumeTxType, uint256 _version) external;

    // use this function to upgrade, need to check the whether the version is registered > 2 weeks
    function upgradeTxoutPredicateTo(uint256 _txoutType, uint256 _consumeTxType, uint256 _version) external;

    // this returns the current version
    function getTxoutPredicate(uint256 _txoutType, uint256 _consumeTxType) public view returns (TxOutputPredicate);
}