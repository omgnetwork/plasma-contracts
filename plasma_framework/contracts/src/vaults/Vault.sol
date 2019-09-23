pragma solidity 0.5.11;

import "./ZeroHashesProvider.sol";
import "../framework/PlasmaFramework.sol";
import "../framework/utils/Operated.sol";

contract Vault is Operated {
    event SetDepositVerifierCalled(address nextDepositVerifier);
    PlasmaFramework internal framework;
    bytes32[16] internal zeroHashes;

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

    modifier onlyFromNonQuarantinedExitGame() {
        require(
            ExitGameRegistry(framework).isExitGameSafeToUse(msg.sender),
            "Called from a nonregistered or quarantined Exit Game contract"
        );
        _;
    }

    function _submitDepositBlock(bytes memory _depositTx) internal returns (uint256) {
        bytes32 root = keccak256(_depositTx);
        for (uint i = 0; i < 16; i++) {
            root = keccak256(abi.encodePacked(root, zeroHashes[i]));
        }

        uint256 depositBlkNum = framework.submitDepositBlock(root);
        return depositBlkNum;
    }

    /**
     * @notice Sets the deposit verifier contract. This can be only called by the operator.
     * @notice When one contract is already set next will be effective after MIN_EXIT_PERIOD.
     * @param _verifier address of the verifier contract.
     */
    function setDepositVerifier(address _verifier) public onlyOperator {
        require(_verifier != address(0), "Cannot set an empty address as deposit verifier");

        if (depositVerifiers[0] != address(0)) {
            depositVerifiers[0] = getEffectiveDepositVerifier();
            depositVerifiers[1] = _verifier;
            newDepositVerifierMaturityTimestamp = now + framework.minExitPeriod();

            emit SetDepositVerifierCalled(depositVerifiers[1]);
        } else {
            depositVerifiers[0] = _verifier;
        }
    }

    /**
     * @notice Gets currently effective deposit verifier contract address.
     * @return contract address of deposit verifier.
     */
    function getEffectiveDepositVerifier() public view returns (address) {
        if (now > newDepositVerifierMaturityTimestamp) {
            return depositVerifiers[1];
        } else {
            return depositVerifiers[0];
        }
    }
}
