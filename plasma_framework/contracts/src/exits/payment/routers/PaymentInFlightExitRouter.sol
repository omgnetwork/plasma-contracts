pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "./PaymentInFlightExitRouterArgs.sol";
import "../PaymentExitDataModel.sol";
import "../controllers/PaymentStartInFlightExit.sol";
import "../controllers/PaymentPiggybackInFlightExit.sol";
import "../controllers/PaymentChallengeIFENotCanonical.sol";
import "../controllers/PaymentChallengeIFEInputSpent.sol";
import "../controllers/PaymentProcessInFlightExit.sol";
import "../controllers/PaymentChallengeIFEOutputSpent.sol";
import "../../registries/SpendingConditionRegistry.sol";
import "../../registries/OutputGuardHandlerRegistry.sol";
import "../../interfaces/IStateTransitionVerifier.sol";
import "../../interfaces/ITxFinalizationVerifier.sol";
import "../../utils/BondSize.sol";
import "../../../utils/FailFastReentrancyGuard.sol";
import "../../../utils/OnlyFromAddress.sol";
import "../../../utils/OnlyWithValue.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../framework/interfaces/IExitProcessor.sol";


contract PaymentInFlightExitRouter is IExitProcessor, OnlyFromAddress, OnlyWithValue, FailFastReentrancyGuard {
    using PaymentStartInFlightExit for PaymentStartInFlightExit.Controller;
    using PaymentPiggybackInFlightExit for PaymentPiggybackInFlightExit.Controller;
    using PaymentChallengeIFENotCanonical for PaymentChallengeIFENotCanonical.Controller;
    using PaymentChallengeIFEInputSpent for PaymentChallengeIFEInputSpent.Controller;
    using PaymentProcessInFlightExit for PaymentProcessInFlightExit.Controller;
    using PaymentChallengeIFEOutputSpent for PaymentChallengeIFEOutputSpent.Controller;
    using BondSize for BondSize.Params;

    // Initial IFE bond size = 185000 (gas cost of challenge) * 20 gwei (current fast gas price) * 10 (safety margin)
    uint128 public constant INITIAL_IFE_BOND_SIZE = 37000000000000000 wei;

    // Initial piggyback bond size = 140000 (gas cost of challenge) * 20 gwei (current fast gas price) * 10 (safety margin)
    uint128 public constant INITIAL_PB_BOND_SIZE = 28000000000000000 wei;

    // Each bond size upgrade can increase to a maximum of 200% or decrease to 50% of the current bond
    uint16 public constant BOND_LOWER_BOUND_DIVISOR = 2;
    uint16 public constant BOND_UPPER_BOUND_MULTIPLIER = 2;

    PaymentExitDataModel.InFlightExitMap internal inFlightExitMap;
    PaymentStartInFlightExit.Controller internal startInFlightExitController;
    PaymentPiggybackInFlightExit.Controller internal piggybackInFlightExitController;
    PaymentChallengeIFENotCanonical.Controller internal challengeCanonicityController;
    PaymentChallengeIFEInputSpent.Controller internal challengeInputSpentController;
    PaymentProcessInFlightExit.Controller internal processInflightExitController;
    PaymentChallengeIFEOutputSpent.Controller internal challengeOutputSpentController;
    BondSize.Params internal startIFEBond;
    BondSize.Params internal piggybackBond;

    PlasmaFramework private framework;

    event IFEBondUpdated(uint128 bondSize);
    event PiggybackBondUpdated(uint128 bondSize);

    event InFlightExitStarted(
        address indexed initiator,
        bytes32 txHash
    );

    event InFlightExitInputPiggybacked(
        address indexed exitTarget,
        bytes32 txHash,
        uint16 inputIndex
    );

    event InFlightExitOmitted(
        uint160 indexed exitId,
        address token
    );

    event InFlightExitOutputWithdrawn(
        uint160 indexed exitId,
        uint16 outputIndex
    );

    event InFlightExitInputWithdrawn(
        uint160 indexed exitId,
        uint16 inputIndex
    );

    event InFlightExitOutputPiggybacked(
        address indexed exitTarget,
        bytes32 txHash,
        uint16 outputIndex
    );

    event InFlightExitChallenged(
        address indexed challenger,
        bytes32 txHash,
        uint256 challengeTxPosition
    );

    event InFlightExitChallengeResponded(
        address challenger,
        bytes32 txHash,
        uint256 challengeTxPosition
    );

    event InFlightExitInputBlocked(
        address indexed challenger,
        bytes32 txHash,
        uint16 inputIndex
    );

    event InFlightExitOutputBlocked(
        address indexed challenger,
        bytes32 ifeTxHash,
        uint16 outputIndex
    );

    constructor(
        PlasmaFramework plasmaFramework,
        uint256 ethVaultId,
        uint256 erc20VaultId,
        OutputGuardHandlerRegistry outputGuardHandlerRegistry,
        SpendingConditionRegistry spendingConditionRegistry,
        IStateTransitionVerifier stateTransitionVerifier,
        ITxFinalizationVerifier txFinalizationVerifier,
        uint256 supportedTxType
    )
        public
    {
        framework = plasmaFramework;

        startInFlightExitController = PaymentStartInFlightExit.buildController(
            plasmaFramework,
            outputGuardHandlerRegistry,
            spendingConditionRegistry,
            stateTransitionVerifier,
            txFinalizationVerifier,
            supportedTxType
        );

        address ethVaultAddress = plasmaFramework.vaults(ethVaultId);
        require(ethVaultAddress != address(0), "Invalid ETH vault");
        EthVault ethVault = EthVault(ethVaultAddress);

        address erc20VaultAddress = plasmaFramework.vaults(erc20VaultId);
        require(erc20VaultAddress != address(0), "Invalid ERC20 vault");
        Erc20Vault erc20Vault = Erc20Vault(erc20VaultAddress);

        piggybackInFlightExitController = PaymentPiggybackInFlightExit.buildController(
            plasmaFramework,
            this,
            outputGuardHandlerRegistry,
            ethVaultId,
            erc20VaultId
        );

        challengeCanonicityController = PaymentChallengeIFENotCanonical.buildController(
            plasmaFramework,
            spendingConditionRegistry,
            outputGuardHandlerRegistry,
            txFinalizationVerifier,
            supportedTxType
        );

        challengeInputSpentController = PaymentChallengeIFEInputSpent.buildController(
            plasmaFramework,
            spendingConditionRegistry,
            outputGuardHandlerRegistry,
            txFinalizationVerifier
        );

        challengeOutputSpentController = PaymentChallengeIFEOutputSpent.Controller(
            plasmaFramework,
            spendingConditionRegistry,
            outputGuardHandlerRegistry,
            txFinalizationVerifier
        );

        processInflightExitController = PaymentProcessInFlightExit.Controller({
            framework: plasmaFramework,
            ethVault: ethVault,
            erc20Vault: erc20Vault
        });
        startIFEBond = BondSize.buildParams(INITIAL_IFE_BOND_SIZE, BOND_LOWER_BOUND_DIVISOR, BOND_UPPER_BOUND_MULTIPLIER);
        piggybackBond = BondSize.buildParams(INITIAL_PB_BOND_SIZE, BOND_LOWER_BOUND_DIVISOR, BOND_UPPER_BOUND_MULTIPLIER);
    }

    /**
     * @notice Getter functions to retrieve in-flight exit data of the PaymentExitGame
     * @param exitId The exit ID of the in-flight exit
     */
    function inFlightExits(uint160 exitId) public view returns (PaymentExitDataModel.InFlightExit memory) {
        return inFlightExitMap.exits[exitId];
    }

    /**
     * @notice Starts withdrawal from a transaction that may be in-flight
     * @param args Input argument data to challenge (see also struct 'StartExitArgs')
     */
    function startInFlightExit(PaymentInFlightExitRouterArgs.StartExitArgs memory args)
        public
        payable
        nonReentrant(framework)
        onlyWithValue(startIFEBondSize())
    {
        startInFlightExitController.run(inFlightExitMap, args);
    }

    /**
     * @notice Piggyback on an input of an in-flight exiting tx. Processed only if the in-flight exit is non-canonical.
     * @param args Input argument data to piggyback (see also struct 'PiggybackInFlightExitOnInputArgs')
     */
    function piggybackInFlightExitOnInput(
        PaymentInFlightExitRouterArgs.PiggybackInFlightExitOnInputArgs memory args
    )
        public
        payable
        nonReentrant(framework)
        onlyWithValue(piggybackBondSize())
    {
        piggybackInFlightExitController.piggybackInput(inFlightExitMap, args);
    }

    /**
     * @notice Piggyback on an output of an in-flight exiting tx. Processed only if the in-flight exit is canonical.
     * @param args Input argument data to piggyback (see also struct 'PiggybackInFlightExitOnOutputArgs')
     */
    function piggybackInFlightExitOnOutput(
        PaymentInFlightExitRouterArgs.PiggybackInFlightExitOnOutputArgs memory args
    )
        public
        payable
        nonReentrant(framework)
        onlyWithValue(piggybackBondSize())
    {
        piggybackInFlightExitController.piggybackOutput(inFlightExitMap, args);
    }

    /**
     * @notice Challenges an in-flight exit to be non-canonical
     * @param args Input argument data to challenge (see also struct 'ChallengeCanonicityArgs')
     */
    function challengeInFlightExitNotCanonical(PaymentInFlightExitRouterArgs.ChallengeCanonicityArgs memory args)
        public
        nonReentrant(framework)
    {
        challengeCanonicityController.challenge(inFlightExitMap, args);
    }

    /**
     * @notice Respond to a non-canonical challenge by providing its position and by proving its correctness
     * @param inFlightTx The RLP-encoded in-flight transaction
     * @param inFlightTxPos The UTXO position of the in-flight exit. The outputIndex should be set to 0.
     * @param inFlightTxInclusionProof Inclusion proof for the in-flight tx
     */
    function respondToNonCanonicalChallenge(
        bytes memory inFlightTx,
        uint256 inFlightTxPos,
        bytes memory inFlightTxInclusionProof
    )
        public
        nonReentrant(framework)
    {
        challengeCanonicityController.respond(inFlightExitMap, inFlightTx, inFlightTxPos, inFlightTxInclusionProof);
    }

    /**
     * @notice Challenges an exit from in-flight transaction input
     * @param args Argument data to challenge (see also struct 'ChallengeInputSpentArgs')
     */
    function challengeInFlightExitInputSpent(PaymentInFlightExitRouterArgs.ChallengeInputSpentArgs memory args)
        public
        nonReentrant(framework)
    {
        challengeInputSpentController.run(inFlightExitMap, args);
    }

     /**
     * @notice Challenges an exit from in-flight transaction output
     * @param args Argument data to challenge (see also struct 'ChallengeOutputSpent')
     */
    function challengeInFlightExitOutputSpent(PaymentInFlightExitRouterArgs.ChallengeOutputSpent memory args)
        public
        nonReentrant(framework)
    {
        challengeOutputSpentController.run(inFlightExitMap, args);
    }

    /**
     * @notice Process in-flight exit
     * @dev This function is designed to be called in the main processExit function, thus, using internal
     * @param exitId The in-flight exit ID
     * @param token The token (in erc20 address or address(0) for ETH) of the exiting output
     */
    function processInFlightExit(uint160 exitId, address token) internal {
        processInflightExitController.run(inFlightExitMap, exitId, token);
    }

    /**
     * @notice Retrieves the in-flight exit bond size
     */
    function startIFEBondSize() public view returns (uint128) {
        return startIFEBond.bondSize();
    }

    /**
     * @notice Updates the in-flight exit bond size, taking two days to become effective.
     * @param newBondSize The new bond size
     */
    function updateStartIFEBondSize(uint128 newBondSize) public onlyFrom(framework.getMaintainer()) {
        startIFEBond.updateBondSize(newBondSize);
        emit IFEBondUpdated(newBondSize);
    }

    /**
     * @notice Retrieves the piggyback bond size
     */
    function piggybackBondSize() public view returns (uint128) {
        return piggybackBond.bondSize();
    }

    /**
     * @notice Updates the piggyback bond size, taking two days to become effective
     * @param newBondSize The new bond size
     */
    function updatePiggybackBondSize(uint128 newBondSize) public onlyFrom(framework.getMaintainer()) {
        piggybackBond.updateBondSize(newBondSize);
        emit PiggybackBondUpdated(newBondSize);
    }
}
