pragma solidity 0.5.11;

/**
 * @title Provides a way to quarantine (disable) contracts for a period of time
 * @dev The immunitiesRemaining member allows us to deploy the platform with some
 * pre-verified contracts that don't get quarantined.
 */
library Quarantine {
    struct Data {
        mapping(address => uint256) store;
        uint256 quarantinePeriod;
        uint256 immunitiesRemaining;
    }

    function isQuarantined(Data storage _self, address _contractAddress) internal view returns (bool) {
        return block.timestamp < _self.store[_contractAddress];
    }

    /**
     * @notice Put a contract into quarantine.
     * @param _contractAddress the address of the contract.
     */
    function quarantine(Data storage _self, address _contractAddress) internal {
        require(_contractAddress != address(0), "Can not quarantine an empty address");
        require(_self.store[_contractAddress] == 0, "The contract is already quarantined");

        if (_self.immunitiesRemaining == 0) {
            _self.store[_contractAddress] = block.timestamp + _self.quarantinePeriod;
        } else {
            _self.immunitiesRemaining--;
        }
    }
}
