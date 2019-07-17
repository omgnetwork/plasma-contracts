pragma solidity ^0.5.0;

import "../utils/Operated.sol";
import "../utils/Quarantine.sol";

contract VaultRegistry is Operated, Quarantine {
    uint8 public constant INITIAL_IMMUNE_VAULTS = 2;

    mapping(uint256 => address) private _vaults;
    mapping(address => uint256) private _vaultToId;

    event VaultRegistered(
        uint256 vaultId,
        address vaultAddress
    );

    constructor (uint256 _minExitPeriod) Quarantine(_minExitPeriod, INITIAL_IMMUNE_VAULTS) public {
    }

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
        require(_vaultId != 0, "should not register with vault id 0");
        require(_vaultAddress != address(0), "should not register an empty vault address");
        require(_vaults[_vaultId] == address(0), "The vault id is already registered");
        require(_vaultToId[_vaultAddress] == 0, "The vault contract is already registered");

        _vaults[_vaultId] = _vaultAddress;
        _vaultToId[_vaultAddress] = _vaultId;

        emit VaultRegistered(_vaultId, _vaultAddress);
        quarantine(_vaultAddress);
    }

    function vaults(uint256 _vaultId) public view returns (address) {
        return _vaults[_vaultId];
    }

    function vaultToId(address _vaultAddress) public view returns (uint256) {
        return _vaultToId[_vaultAddress];
    }
}
