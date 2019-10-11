pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "./PaymentStandardExitRouterArgs.sol";
import "../PaymentExitDataModel.sol";
import "../controllers/PaymentStartStandardExit.sol";
import "../controllers/PaymentProcessStandardExit.sol";
import "../controllers/PaymentChallengeStandardExit.sol";
import "../../interfaces/ITxFinalizationVerifier.sol";
import "../../registries/SpendingConditionRegistry.sol";
import "../../registries/OutputGuardHandlerRegistry.sol";
import "../../utils/BondSize.sol";
import "../../../vaults/EthVault.sol";
import "../../../vaults/Erc20Vault.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../framework/interfaces/IExitProcessor.sol";
import "../../../framework/utils/Operated.sol";
import "../../../utils/GracefulReentrancyGuard.sol";
import "../../../utils/OnlyWithValue.sol";

import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";

contract PaymentStandardExitRouter is
    IExitProcessor,
    Operated,
    OnlyWithValue,
    ReentrancyGuard,
    GracefulReentrancyGuard
{
    using PaymentStartStandardExit for PaymentStartStandardExit.Controller;
    using PaymentChallengeStandardExit for PaymentChallengeStandardExit.Controller;
    using PaymentProcessStandardExit for PaymentProcessStandardExit.Controller;
    using BondSize for BondSize.Params;

    // Initial bond size = 70000 (gas cost of challenge) * 20 gwei (current fast gas price) * 10 (safety margin)
    uint128 public constant INITIAL_BOND_SIZE = 14000000000000000 wei;

    // each bond size upgrade can either at most increase to 200% or decrease to 50% of current bond
    uint16 public constant BOND_LOWER_BOUND_DIVISOR = 2;
    uint16 public constant BOND_UPPER_BOUND_MULTIPLIER = 2;

    PaymentExitDataModel.StandardExitMap internal standardExitMap;
    PaymentStartStandardExit.Controller internal startStandardExitController;
    PaymentProcessStandardExit.Controller internal processStandardExitController;
    PaymentChallengeStandardExit.Controller internal challengeStandardExitController;
    BondSize.Params internal startStandardExitBond;

    event StandardExitBondUpdated(uint128 bondSize);

    event ExitStarted(
        address indexed owner,
        uint160 exitId
    );

    event ExitChallenged(
        uint256 indexed utxoPos
    );

    event ExitOmitted(
        uint160 indexed exitId
    );

    event ExitFinalized(
        uint160 indexed exitId
    );

    constructor(
        PlasmaFramework framework,
        uint256 ethVaultId,
        uint256 erc20VaultId,
        OutputGuardHandlerRegistry outputGuardHandlerRegistry,
        SpendingConditionRegistry spendingConditionRegistry,
        ITxFinalizationVerifier txFinalizationVerifier
    )
        public
    {
        address ethVaultAddress = framework.vaults(ethVaultId);
        require(ethVaultAddress != address(0), "Invalid ETH vault");
        EthVault ethVault = EthVault(ethVaultAddress);

        address erc20VaultAddress = framework.vaults(erc20VaultId);
        require(erc20VaultAddress != address(0), "Invalid ERC20 vault");
        Erc20Vault erc20Vault = Erc20Vault(erc20VaultAddress);

        startStandardExitController = PaymentStartStandardExit.buildController(
            this, framework, outputGuardHandlerRegistry, txFinalizationVerifier, ethVaultId, erc20VaultId
        );

        challengeStandardExitController = PaymentChallengeStandardExit.buildController(
            framework, spendingConditionRegistry, outputGuardHandlerRegistry, txFinalizationVerifier
        );

        processStandardExitController = PaymentProcessStandardExit.Controller(
            framework, ethVault, erc20Vault
        );

        startStandardExitBond = BondSize.buildParams(INITIAL_BOND_SIZE, BOND_LOWER_BOUND_DIVISOR, BOND_UPPER_BOUND_MULTIPLIER);
    }

    /**
     * @notice Getter functions to retrieve standard exit data of the PaymentExitGame.
     * @param exitId the exit id of such standard exit.
     */
    function standardExits(uint160 exitId) public view returns (PaymentExitDataModel.StandardExit memory) {
        return standardExitMap.exits[exitId];
    }

    /**
     * @notice Gets the standard exit bond size.
     */
    function startStandardExitBondSize() public view returns (uint128) {
        return startStandardExitBond.bondSize();
    }

    /**
     * @notice Updates the standard exit bond size. Will take 2 days to come into effect.
     * @param newBondSize The new bond size.
     */
    function updateStartStandardExitBondSize(uint128 newBondSize) public onlyOperator {
        startStandardExitBond.updateBondSize(newBondSize);
        emit StandardExitBondUpdated(newBondSize);
    }

    /**
     * @notice Starts a standard exit of a given output. Uses output-age priority.
     */
    function startStandardExit(
        PaymentStandardExitRouterArgs.StartStandardExitArgs memory args
    )
        public
        payable
        onlyWithValue(startStandardExitBondSize())
    {
        startStandardExitController.run(standardExitMap, args);
    }

    /**
     * @notice Challenge a standard exit by showing the exiting output was spent.
     */
    function challengeStandardExit(PaymentStandardExitRouterArgs.ChallengeStandardExitArgs memory args)
        public
        payable
        nonReentrant
    {
        challengeStandardExitController.run(standardExitMap, args);
    }

    /**
     * @notice Process standard exit.
     * @dev This function is designed to be called in the main processExit function. Thus using internal.
     * @param exitId The standard exit id.
     * @param token The token (in erc20 address or address(0) for ETH) of the exiting output.
     */
    function processStandardExit(uint160 exitId, address token) internal gracefullyNonReentrant {
        processStandardExitController.run(standardExitMap, exitId, token);
    }
}
