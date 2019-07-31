pragma solidity ^0.5.0;

import "./ZeroHashesProvider.sol";
import "../framework/PlasmaFramework.sol";
import "../framework/utils/Operated.sol";

contract Vault is Operated {
    PlasmaFramework framework;
    bytes32[16] zeroHashes;

    address private _currentDepositVerifier;
    address private _newDepositVerifier;
    uint256 private _newDepositVerifierEffectivePeriod;

    constructor(PlasmaFramework _framework) public {
        framework = _framework;
        zeroHashes = ZeroHashesProvider.getZeroHashes();
    }

    modifier onlyFromExitGame() {
        require(
            framework.exitGameToTxType(msg.sender) != 0,
            "Not called from a registered Exit Game contract"
        );
        _;
    }

    function _submitDepositBlock(bytes memory _depositTx) internal {
        bytes32 root = keccak256(_depositTx);
        for (uint i = 0; i < 16; i++) {
            root = keccak256(abi.encodePacked(root, zeroHashes[i]));
        }

        framework.submitDepositBlock(root);
    }

    /**
     * @notice Sets the deposit verifier contract. This can be only called by the operator.
     * @notice When one contract is already set next will be effective after MIN_EXIT_PERIOD.
     * @param _contract address of the verifier contract.
     */
    function setDepositVerifier(address _contract) public onlyOperator {
        require(_contract != address(0), "Cannot set an empty address as deposit verifier");

        if (_currentDepositVerifier != address(0)) {
            _newDepositVerifier = _contract;
            _newDepositVerifierEffectivePeriod = block.timestamp + framework.minExitPeriod();
        } else {
            _currentDepositVerifier = _contract;
        }
    }

    /**
     * @notice Gets currently effective deposit verifier contract address.
     * @return contract address of deposit verifier.
     */
    function getDepositVerifier() public view returns (address) {
        require(_currentDepositVerifier != address(0), "Deposit verifier was not set yet.");
        return _currentDepositVerifier;
    }

    function swapDepositVerifiersIfNewerGetsEffective() internal {
        if (_newDepositVerifier != address(0) && _newDepositVerifierEffectivePeriod <= block.timestamp) {
            _currentDepositVerifier = _newDepositVerifier;
            _newDepositVerifier = address(0);
        }
    }
}
