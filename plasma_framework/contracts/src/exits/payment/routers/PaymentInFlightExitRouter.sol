pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "./PaymentInFlightExitRouterArgs.sol";
import "../PaymentExitDataModel.sol";
import "../PaymentExitGameArgs.sol";
import "../controllers/PaymentStartInFlightExit.sol";
import "../controllers/PaymentPiggybackInFlightExit.sol";
import "../controllers/PaymentChallengeIFENotCanonical.sol";
import "../controllers/PaymentChallengeIFEInputSpent.sol";
import "../controllers/PaymentChallengeIFEOutputSpent.sol";
import "../controllers/PaymentDeleteInFlightExit.sol";
import "../controllers/PaymentProcessInFlightExit.sol";
import "../../registries/SpendingConditionRegistry.sol";
import "../../interfaces/IStateTransitionVerifier.sol";
import "../../utils/BondSize.sol";
import "../../../utils/FailFastReentrancyGuard.sol";
import "../../../utils/OnlyFromAddress.sol";
import "../../../utils/OnlyWithValue.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../framework/interfaces/IExitProcessor.sol";


contract PaymentInFlightExitRouter is
    IExitProcessor,
    OnlyFromAddress,
    OnlyWithValue,
    FailFastReentrancyGuard
{
    using PaymentStartInFlightExit for PaymentStartInFlightExit.Controller;
    using PaymentPiggybackInFlightExit for PaymentPiggybackInFlightExit.Controller;
    using PaymentChallengeIFENotCanonical for PaymentChallengeIFENotCanonical.Controller;
    using PaymentChallengeIFEInputSpent for PaymentChallengeIFEInputSpent.Controller;
    using PaymentChallengeIFEOutputSpent for PaymentChallengeIFEOutputSpent.Controller;
    using PaymentDeleteInFlightExit for PaymentDeleteInFlightExit.Controller;
    using PaymentProcessInFlightExit for PaymentProcessInFlightExit.Controller;
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
    PaymentChallengeIFEOutputSpent.Controller internal challengeOutputSpentController;
    PaymentDeleteInFlightExit.Controller internal deleteNonPiggybackIFEController;
    PaymentProcessInFlightExit.Controller internal processInflightExitController;
    BondSize.Params internal startIFEBond;
    BondSize.Params internal piggybackBond;

    PlasmaFramework private framework;

    event IFEBondUpdated(uint128 bondSize);
    event PiggybackBondUpdated(uint128 bondSize);

    event InFlightExitStarted(
        address indexed initiator,
        bytes32 indexed txHash
    );

    event InFlightExitInputPiggybacked(
        address indexed exitTarget,
        bytes32 indexed txHash,
        uint16 inputIndex
    );

    event InFlightExitOmitted(
        uint168 indexed exitId,
        address token
    );

    event InFlightBondReturnFailed(
        address indexed receiver,
        uint256 amount
    );

    event InFlightExitOutputWithdrawn(
        uint168 indexed exitId,
        uint16 outputIndex
    );

    event InFlightExitInputWithdrawn(
        uint168 indexed exitId,
        uint16 inputIndex
    );

    event InFlightExitOutputPiggybacked(
        address indexed exitTarget,
        bytes32 indexed txHash,
        uint16 outputIndex
    );

    event InFlightExitChallenged(
        address indexed challenger,
        bytes32 indexed txHash,
        uint256 challengeTxPosition
    );

    event InFlightExitChallengeResponded(
        address indexed challenger,
        bytes32 indexed txHash,
        uint256 challengeTxPosition
    );

    event InFlightExitInputBlocked(
        address indexed challenger,
        bytes32 indexed txHash,
        uint16 inputIndex
    );

    event InFlightExitOutputBlocked(
        address indexed challenger,
        bytes32 indexed txHash,
        uint16 outputIndex
    );

    event InFlightExitDeleted(
        uint168 indexed exitId
    );

    constructor(PaymentExitGameArgs.Args memory args)
        public
    {
        framework = args.framework;

        EthVault ethVault = EthVault(args.framework.vaults(args.ethVaultId));
        require(address(ethVault) != address(0), "Invalid ETH vault");

        Erc20Vault erc20Vault = Erc20Vault(args.framework.vaults(args.erc20VaultId));
        require(address(erc20Vault) != address(0), "Invalid ERC20 vault");

        startInFlightExitController = PaymentStartInFlightExit.buildController(
            args.framework,
            args.spendingConditionRegistry,
            args.stateTransitionVerifier,
            args.supportTxType
        );

        piggybackInFlightExitController = PaymentPiggybackInFlightExit.buildController(
            args.framework,
            this,
            args.ethVaultId,
            args.erc20VaultId
        );

        challengeCanonicityController = PaymentChallengeIFENotCanonical.buildController(
            args.framework,
            args.spendingConditionRegistry,
            args.supportTxType
        );

        challengeInputSpentController = PaymentChallengeIFEInputSpent.buildController(
            args.framework,
            args.spendingConditionRegistry,
            args.safeGasStipend
        );

        challengeOutputSpentController = PaymentChallengeIFEOutputSpent.Controller(
            args.framework,
            args.spendingConditionRegistry,
            args.safeGasStipend
        );

        deleteNonPiggybackIFEController = PaymentDeleteInFlightExit.Controller({
            minExitPeriod: args.framework.minExitPeriod(),
            safeGasStipend: args.safeGasStipend
        });

        processInflightExitController = PaymentProcessInFlightExit.Controller({
            framework: args.framework,
            ethVault: ethVault,
            erc20Vault: erc20Vault,
            safeGasStipend: args.safeGasStipend
        });
        startIFEBond = BondSize.buildParams(INITIAL_IFE_BOND_SIZE, BOND_LOWER_BOUND_DIVISOR, BOND_UPPER_BOUND_MULTIPLIER);
        piggybackBond = BondSize.buildParams(INITIAL_PB_BOND_SIZE, BOND_LOWER_BOUND_DIVISOR, BOND_UPPER_BOUND_MULTIPLIER);
    }

    /**
     * @notice Getter functions to retrieve in-flight exit data of the PaymentExitGame
     * @param exitIds The exit IDs of the in-flight exits
     */
    function inFlightExits(uint168[] calldata exitIds) external view returns (PaymentExitDataModel.InFlightExit[] memory) {
        PaymentExitDataModel.InFlightExit[] memory exits = new PaymentExitDataModel.InFlightExit[](exitIds.length);
        for (uint i = 0; i < exitIds.length; i++) {
            uint168 exitId = exitIds[i];
            exits[i] = inFlightExitMap.exits[exitId];
        }
        return exits;
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
     * @param inFlightTxPos The position of the in-flight exiting transaction. The output index within the position is unused and should be set to 0
     * @param inFlightTxInclusionProof Proof that the in-flight exiting transaction is included in a Plasma block
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
     * @notice Deletes in-flight exit if the first phase has passed and not being piggybacked
     * @dev Since IFE is enqueued during piggyback, a non-piggybacked IFE means that it will never be processed.
     *      This means that the IFE bond will never be returned.
     *      see: https://github.com/omisego/plasma-contracts/issues/440
     * @param exitId The exitId of the in-flight exit
     */
    function deleteNonPiggybackedInFlightExit(uint168 exitId) public nonReentrant(framework) {
        deleteNonPiggybackIFEController.run(inFlightExitMap, exitId);
    }

    /**
     * @notice Process in-flight exit
     * @dev This function is designed to be called in the main processExit function, thus, using internal
     * @param exitId The in-flight exit ID
     * @param token The token (in erc20 address or address(0) for ETH) of the exiting output
     */
    function processInFlightExit(uint168 exitId, address token) internal {
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
