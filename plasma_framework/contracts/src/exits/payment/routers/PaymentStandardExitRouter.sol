pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "./PaymentStandardExitRouterArgs.sol";
import "../PaymentExitGameArgs.sol";
import "../PaymentExitDataModel.sol";
import "../controllers/PaymentStartStandardExit.sol";
import "../controllers/PaymentProcessStandardExit.sol";
import "../controllers/PaymentChallengeStandardExit.sol";
import "../../registries/SpendingConditionRegistry.sol";
import "../../utils/BondSize.sol";
import "../../../vaults/EthVault.sol";
import "../../../vaults/Erc20Vault.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../framework/interfaces/IExitProcessor.sol";
import "../../../utils/OnlyWithValue.sol";
import "../../../utils/OnlyFromAddress.sol";
import "../../../utils/FailFastReentrancyGuard.sol";

contract PaymentStandardExitRouter is
    IExitProcessor,
    OnlyFromAddress,
    OnlyWithValue,
    FailFastReentrancyGuard
{
    using PaymentStartStandardExit for PaymentStartStandardExit.Controller;
    using PaymentChallengeStandardExit for PaymentChallengeStandardExit.Controller;
    using PaymentProcessStandardExit for PaymentProcessStandardExit.Controller;
    using BondSize for BondSize.Params;

    // Initial bond size = 70000 (gas cost of challenge) * 20 gwei (current fast gas price) * 10 (safety margin)
    uint128 public constant INITIAL_BOND_SIZE = 14000000000000000 wei;

    // Each bond size upgrade can either at most increase to 200% or decrease to 50% of current bond
    uint16 public constant BOND_LOWER_BOUND_DIVISOR = 2;
    uint16 public constant BOND_UPPER_BOUND_MULTIPLIER = 2;

    PaymentExitDataModel.StandardExitMap internal standardExitMap;
    PaymentStartStandardExit.Controller internal startStandardExitController;
    PaymentProcessStandardExit.Controller internal processStandardExitController;
    PaymentChallengeStandardExit.Controller internal challengeStandardExitController;
    BondSize.Params internal startStandardExitBond;

    PlasmaFramework private framework;

    event StandardExitBondUpdated(uint128 bondSize);

    event ExitStarted(
        address indexed owner,
        uint168 exitId
    );

    event ExitChallenged(
        uint256 indexed utxoPos
    );

    event ExitOmitted(
        uint168 indexed exitId
    );

    event ExitFinalized(
        uint168 indexed exitId
    );

    event BondReturnFailed(
        address indexed receiver,
        uint256 amount
    );

    constructor(PaymentExitGameArgs.Args memory args)
        public
    {
        framework = args.framework;

        EthVault ethVault = EthVault(args.framework.vaults(args.ethVaultId));
        require(address(ethVault) != address(0), "Invalid ETH vault");

        Erc20Vault erc20Vault = Erc20Vault(args.framework.vaults(args.erc20VaultId));
        require(address(erc20Vault) != address(0), "Invalid ERC20 vault");

        startStandardExitController = PaymentStartStandardExit.buildController(
            this,
            args.framework,
            args.ethVaultId,
            args.erc20VaultId,
            args.supportTxType
        );

        challengeStandardExitController = PaymentChallengeStandardExit.buildController(
            args.framework,
            args.spendingConditionRegistry,
            args.safeGasStipend
        );

        processStandardExitController = PaymentProcessStandardExit.Controller(
            args.framework, ethVault, erc20Vault, args.safeGasStipend
        );

        startStandardExitBond = BondSize.buildParams(INITIAL_BOND_SIZE, BOND_LOWER_BOUND_DIVISOR, BOND_UPPER_BOUND_MULTIPLIER);
    }

    /**
     * @notice Getter retrieves standard exit data of the PaymentExitGame
     * @param exitIds Exit IDs of the standard exits
     */
    function standardExits(uint168[] calldata exitIds) external view returns (PaymentExitDataModel.StandardExit[] memory) {
        PaymentExitDataModel.StandardExit[] memory exits = new PaymentExitDataModel.StandardExit[](exitIds.length);
        for (uint i = 0; i < exitIds.length; i++){
            uint168 exitId = exitIds[i];
            exits[i] = standardExitMap.exits[exitId];
        }
        return exits;
    }

    /**
     * @notice Retrieves the standard exit bond size
     */
    function startStandardExitBondSize() public view returns (uint128) {
        return startStandardExitBond.bondSize();
    }

    /**
     * @notice Updates the standard exit bond size, taking two days to become effective
     * @param newBondSize The new bond size
     */
    function updateStartStandardExitBondSize(uint128 newBondSize) public onlyFrom(framework.getMaintainer()) {
        startStandardExitBond.updateBondSize(newBondSize);
        emit StandardExitBondUpdated(newBondSize);
    }

    /**
     * @notice Starts a standard exit of a given output, using output-age priority
     */
    function startStandardExit(
        PaymentStandardExitRouterArgs.StartStandardExitArgs memory args
    )
        public
        payable
        nonReentrant(framework)
        onlyWithValue(startStandardExitBondSize())
    {
        startStandardExitController.run(standardExitMap, args);
    }

    /**
     * @notice Challenge a standard exit by showing the exiting output was spent
     */
    function challengeStandardExit(PaymentStandardExitRouterArgs.ChallengeStandardExitArgs memory args)
        public
        nonReentrant(framework)
    {
        challengeStandardExitController.run(standardExitMap, args);
    }

    /**
     * @notice Process standard exit
     * @dev This function is designed to be called in the main processExit function, using internal
     * @param exitId The standard exit ID
     * @param token The token (in erc20 address or address(0) for ETH) of the exiting output
     */
    function processStandardExit(uint168 exitId, address token) internal {
        processStandardExitController.run(standardExitMap, exitId, token);
    }
}
