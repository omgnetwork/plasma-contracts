pragma solidity ^0.5.0;

import "../utils/Operated.sol";

contract VaultRegistry is Operated {
    mapping(uint256 => address) private _vaults;
    mapping(address => uint256) private _vaultToId;

    modifier onlyFromVault() {
        require(_vaultToId[msg.sender] > 0, "Not being called by registered vaults");
        _;
    }

    /**
     * @notice Register the vault to Plasma framework. This can be only called by contract admin.
     * @param _vaultId the id for the vault contract to register.
     * @param _vaultAddress address of the vault contract.
     */
    function registerVault(uint256 _vaultId, address _vaultAddress) public onlyOperator {
        require(_vaults[_vaultId] == address(0), "The vault id is already registered");
        require(_vaultToId[_vaultAddress] == 0, "The vault contract is already registered");

        _vaults[_vaultId] = _vaultAddress;
        _vaultToId[_vaultAddress] = _vaultId;
    }

    function vaults(uint256 _vaultId) public view returns (address) {
        return _vaults[_vaultId];
    }

    function vaultToId(address _vaultAddress) public view returns (uint256) {
        return _vaultToId[_vaultAddress];
    }
}
