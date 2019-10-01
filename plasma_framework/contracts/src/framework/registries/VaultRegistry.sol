pragma solidity 0.5.11;

import "../utils/Operated.sol";
import "../utils/Quarantine.sol";

contract VaultRegistry is Operated {
    using Quarantine for Quarantine.Data;

    mapping(uint256 => address) private _vaults; // vault id => vault address
    mapping(address => uint256) private _vaultToId; // vault address => vault id
    Quarantine.Data private _vaultQuarantine;

    event VaultRegistered(
        uint256 vaultId,
        address vaultAddress
    );

    /**
     * @dev For each new vault contract, it should take at least 1 minExitPeriod to be able to start take effect to protect deposit transaction in mempool.
     *      see: https://github.com/omisego/plasma-contracts/issues/173
     */
    constructor (uint256 _minExitPeriod, uint256 _initialImmuneVaults)
        public
    {
        _vaultQuarantine.quarantinePeriod = _minExitPeriod;
        _vaultQuarantine.immunitiesRemaining = _initialImmuneVaults;
    }

    /**
     * @notice modifier to check the call is from a non-quarantined vault.
     */
    modifier onlyFromNonQuarantinedVault() {
        require(_vaultToId[msg.sender] > 0, "Not being called by registered vaults");
        require(!_vaultQuarantine.isQuarantined(msg.sender), "Vault is quarantined.");
        _;
    }

    /**
     * @notice Register the vault to Plasma framework. This can be only called by contract admin.
     * @dev emits VaultRegistered event to notify clients
     * @param _vaultId the id for the vault contract to register.
     * @param _vaultAddress address of the vault contract.
     */
    function registerVault(uint256 _vaultId, address _vaultAddress) public onlyOperator {
        require(_vaultId != 0, "should not register with vault id 0");
        require(_vaultAddress != address(0), "should not register an empty vault address");
        require(_vaults[_vaultId] == address(0), "The vault id is already registered");
        require(_vaultToId[_vaultAddress] == 0, "The vault contract is already registered");

        _vaults[_vaultId] = _vaultAddress;
        _vaultToId[_vaultAddress] = _vaultId;
        _vaultQuarantine.quarantine(_vaultAddress);

        emit VaultRegistered(_vaultId, _vaultAddress);
    }

    /**
     * @notice public getter for getting vault address with vault id
     */
    function vaults(uint256 _vaultId) public view returns (address) {
        return _vaults[_vaultId];
    }

    /**
     * @notice public getter for getting vault id with vault address
     */
    function vaultToId(address _vaultAddress) public view returns (uint256) {
        return _vaultToId[_vaultAddress];
    }
}
