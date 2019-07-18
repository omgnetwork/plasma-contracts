pragma solidity ^0.5.0;

import "../utils/Operated.sol";

/**
 * @title Provides a way to quarantine (disable) contracts for a period of time
 */
contract Quarantine is Operated {
    mapping(address => uint256) private _quarantine;
    uint256 private _quarantinePeriod;
    uint256 private _immunitiesRemaining;

    /**
     * @dev The _initialImmuneCount parameter allows us to deploy the platform with some
     * pre-verified contracts that don't get quarantined.
     * @param _period the period of time in seconds to quarantine contracts.
     * @param _initialImmuneCount the first _initialImmuneCount contracts don't get quarantined.
     */
    constructor (uint256 _period, uint256 _initialImmuneCount) public {
        _quarantinePeriod = _period;
        _immunitiesRemaining = _initialImmuneCount;
    }

    modifier notQuarantined(address _contractAddress) {
        require(block.timestamp > _quarantine[_contractAddress], "Contract is quarantined.");
        delete _quarantine[_contractAddress];
        _;
    }

    /**
     * @notice Put a contract into quarantine.
     * @param _contractAddress the address of the contract.
     */
    function quarantine(address _contractAddress) public onlyOperator {
        require(_contractAddress != address(0), "Can not quarantine an empty address");
        require(_quarantine[_contractAddress] == 0, "The contract is already quarantined");

        if (_immunitiesRemaining == 0) {
            _quarantine[_contractAddress] = block.timestamp + _quarantinePeriod;
        } else {
            _immunitiesRemaining--;
        }
    }
}
