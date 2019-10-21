pragma solidity 0.5.11;

import "./ZeroHashesProvider.sol";
import "../framework/PlasmaFramework.sol";
import "../utils/OnlyFromAddress.sol";

/**
 * @notice Base contract for vault implementation
 * @dev This is the functionality to swap "deposit verifier"
 *      Setting a new deposit verifier allows an upgrade to a new deposit tx type without upgrading the vault
 */
contract Vault is OnlyFromAddress {
    event SetDepositVerifierCalled(address nextDepositVerifier);
    PlasmaFramework internal framework;
    bytes32[16] internal zeroHashes; // Pre-computes zero hashes to be used for building merkle tree for deposit block

    /**
     * @notice Stores deposit verifier contract addresses; first contract address is effective until the
     *  `newDepositVerifierMaturityTimestamp`; second contract address becomes effective after that timestamp
    */
    address[2] public depositVerifiers;
    uint256 public newDepositVerifierMaturityTimestamp = 2 ** 255; // point far in the future

    constructor(PlasmaFramework _framework) public {
        framework = _framework;
        zeroHashes = ZeroHashesProvider.getZeroHashes();
    }

    /**
     * @notice Checks whether the call originates from a non-quarantined exit game contract
    */
    modifier onlyFromNonQuarantinedExitGame() {
        require(
            ExitGameRegistry(framework).isExitGameSafeToUse(msg.sender),
            "Called from a non-registered or quarantined exit game contract"
        );
        _;
    }

    /**
     * @notice Sets the deposit verifier contract, which may be called only by the operator
     * @dev emit SetDepositVerifierCalled
     * @dev When one contract is already set, the next one is effective after MIN_EXIT_PERIOD
     * @param _verifier Address of the verifier contract
     */
    function setDepositVerifier(address _verifier) public onlyFrom(framework.getMaintainer()) {
        require(_verifier != address(0), "Cannot set an empty address as deposit verifier");

        if (depositVerifiers[0] != address(0)) {
            depositVerifiers[0] = getEffectiveDepositVerifier();
            depositVerifiers[1] = _verifier;
            newDepositVerifierMaturityTimestamp = now + framework.minExitPeriod();
        } else {
            depositVerifiers[0] = _verifier;
        }

        emit SetDepositVerifierCalled(_verifier);
    }

    /**
     * @notice Retrieves the currently effective deposit verifier contract address
     * @return Contract address of the deposit verifier
     */
    function getEffectiveDepositVerifier() public view returns (address) {
        if (now < newDepositVerifierMaturityTimestamp) {
            return depositVerifiers[0];
        } else {
            return depositVerifiers[1];
        }
    }

    /**
     * @notice Generate and submit a deposit block root to the PlasmaFramework
     * @dev Designed to be called by the contract that inherits Vault
     */
    function _submitDepositBlock(bytes memory _depositTx) internal returns (uint256) {
        bytes32 root = keccak256(_depositTx);
        for (uint i = 0; i < 16; i++) {
            root = keccak256(abi.encodePacked(root, zeroHashes[i]));
        }

        uint256 depositBlkNum = framework.submitDepositBlock(root);
        return depositBlkNum;
    }
}
