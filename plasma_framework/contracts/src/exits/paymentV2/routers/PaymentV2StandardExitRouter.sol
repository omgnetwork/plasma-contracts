pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "./PaymentV2StandardExitRouterArgs.sol";
import "../PaymentV2ExitGameArgs.sol";
import "../PaymentV2ExitDataModel.sol";
import "../controllers/PaymentV2StartStandardExit.sol";
import "../controllers/PaymentV2ProcessStandardExit.sol";
import "../controllers/PaymentV2ChallengeStandardExit.sol";
import "../../registries/SpendingConditionRegistry.sol";
import "../../utils/BondSize.sol";
import "../../../vaults/EthVault.sol";
import "../../../vaults/Erc20Vault.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../framework/interfaces/IExitProcessor.sol";
import "../../../utils/OnlyWithValue.sol";
import "../../../utils/OnlyFromAddress.sol";
import "../../../utils/FailFastReentrancyGuard.sol";

contract PaymentV2StandardExitRouter is
    IExitProcessor,
    OnlyFromAddress,
    OnlyWithValue,
    FailFastReentrancyGuard
{
    using PaymentV2StartStandardExit for PaymentV2StartStandardExit.Controller;
    using PaymentV2ChallengeStandardExit for PaymentV2ChallengeStandardExit.Controller;
    using PaymentV2ProcessStandardExit for PaymentV2ProcessStandardExit.Controller;
    using BondSize for BondSize.Params;

    // Initial bond size = 70000 (gas cost of challenge) * 20 gwei (current fast gas price) * 10 (safety margin)
    uint128 public constant INITIAL_BOND_SIZE = 14000000000000000 wei;

    // Each bond size upgrade can either at most increase to 200% or decrease to 50% of current bond
    uint16 public constant BOND_LOWER_BOUND_DIVISOR = 2;
    uint16 public constant BOND_UPPER_BOUND_MULTIPLIER = 2;

    PaymentV2ExitDataModel.StandardExitMap internal standardExitMap;
    PaymentV2StartStandardExit.Controller internal startStandardExitController;
    PaymentV2ProcessStandardExit.Controller internal processStandardExitController;
    PaymentV2ChallengeStandardExit.Controller internal challengeStandardExitController;
    BondSize.Params internal startStandardExitBond;

    PlasmaFramework private framework;

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

    event BondReturnFailed(
        address indexed receiver,
        uint256 amount
    );

    constructor(PaymentV2ExitGameArgs.Args memory args)
        public
    {
        framework = args.framework;

        EthVault ethVault = EthVault(args.framework.vaults(args.ethVaultId));
        require(address(ethVault) != address(0), "Invalid ETH vault");

        Erc20Vault erc20Vault = Erc20Vault(args.framework.vaults(args.erc20VaultId));
        require(address(erc20Vault) != address(0), "Invalid ERC20 vault");

        startStandardExitController = PaymentV2StartStandardExit.buildController(
            this,
            args.framework,
            args.ethVaultId,
            args.erc20VaultId,
            args.supportTxType
        );

        challengeStandardExitController = PaymentV2ChallengeStandardExit.buildController(
            args.framework,
            args.spendingConditionRegistry,
            args.safeGasStipend
        );

        processStandardExitController = PaymentV2ProcessStandardExit.Controller(
            args.framework, ethVault, erc20Vault, args.safeGasStipend
        );

        startStandardExitBond = BondSize.buildParams(INITIAL_BOND_SIZE, BOND_LOWER_BOUND_DIVISOR, BOND_UPPER_BOUND_MULTIPLIER);
    }

    /**
     * @notice Getter retrieves standard exit data of the PaymentExitGame
     * @param exitIds Exit IDs of the standard exits
     */
    function standardExits(uint160[] calldata exitIds) external view returns (PaymentV2ExitDataModel.StandardExit[] memory) {
        PaymentV2ExitDataModel.StandardExit[] memory exits = new PaymentV2ExitDataModel.StandardExit[](exitIds.length);
        for (uint i = 0; i < exitIds.length; i++){
            uint160 exitId = exitIds[i];
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
        PaymentV2StandardExitRouterArgs.StartStandardExitArgs memory args
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
    function challengeStandardExit(PaymentV2StandardExitRouterArgs.ChallengeStandardExitArgs memory args)
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
    function processStandardExit(uint160 exitId, address token) internal {
        processStandardExitController.run(standardExitMap, exitId, token);
    }
}
