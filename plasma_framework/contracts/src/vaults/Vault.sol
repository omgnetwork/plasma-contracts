pragma solidity 0.5.11;

import "./ZeroHashesProvider.sol";
import "../framework/PlasmaFramework.sol";
import "../framework/utils/Operated.sol";

/**
 * @notice Base contract for vault implementation
 * @dev This is the functionality to swap "deposit verifier".
 *      By setting new deposit verifier, we can upgrade to a new deposit tx type without upgrading the vault.
 */
contract Vault is Operated {
    event SetDepositVerifierCalled(address nextDepositVerifier);
    PlasmaFramework internal framework;
    bytes32[16] internal zeroHashes; // Pre-computes zero hashes to be used for building merkle tree for deposit block

    /**
     * @notice Stores deposit verifier contracts addresses where first was effective upto
     *  `newDepositVerifierMaturityTimestamp` point of time and second become effective after
    */
    address[2] public depositVerifiers;
    uint256 public newDepositVerifierMaturityTimestamp = 2 ** 255; // point far in the future

    constructor(PlasmaFramework _framework) public {
        framework = _framework;
        zeroHashes = ZeroHashesProvider.getZeroHashes();
    }

    /**
     * @notice Checks it is called by a non quarantined exit game contract
    */
    modifier onlyFromNonQuarantinedExitGame() {
        require(
            ExitGameRegistry(framework).isExitGameSafeToUse(msg.sender),
            "Called from a nonregistered or quarantined Exit Game contract"
        );
        _;
    }

    /**
     * @notice Sets the deposit verifier contract. This can be only called by the operator.
     * @dev emit SetDepositVerifierCalled
     * @dev When one contract is already set next will be effective after MIN_EXIT_PERIOD.
     * @param _verifier address of the verifier contract.
     */
    function setDepositVerifier(address _verifier) public onlyOperator {
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
     * @notice Gets currently effective deposit verifier contract address.
     * @return contract address of deposit verifier.
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
     * @dev designed to be called by the contract that inherits Vault
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
