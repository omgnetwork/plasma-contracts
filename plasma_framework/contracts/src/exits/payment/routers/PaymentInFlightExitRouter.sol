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
import "../../../utils/OnlyWithValue.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../framework/interfaces/IExitProcessor.sol";

contract PaymentInFlightExitRouter is IExitProcessor, OnlyWithValue {
    using PaymentStartInFlightExit for PaymentStartInFlightExit.Controller;
    using PaymentPiggybackInFlightExit for PaymentPiggybackInFlightExit.Controller;
    using PaymentChallengeIFENotCanonical for PaymentChallengeIFENotCanonical.Controller;
    using PaymentChallengeIFEInputSpent for PaymentChallengeIFEInputSpent.Controller;
    using PaymentProcessInFlightExit for PaymentProcessInFlightExit.Controller;
    using PaymentChallengeIFEOutputSpent for PaymentChallengeIFEOutputSpent.Controller;

    uint256 public constant IN_FLIGHT_EXIT_BOND = 31415926535 wei;
    uint256 public constant PIGGYBACK_BOND = 31415926535 wei;

    PaymentExitDataModel.InFlightExitMap internal inFlightExitMap;
    PaymentStartInFlightExit.Controller internal startInFlightExitController;
    PaymentPiggybackInFlightExit.Controller internal piggybackInFlightExitController;
    PaymentChallengeIFENotCanonical.Controller internal challengeCanonicityController;
    PaymentChallengeIFEInputSpent.Controller internal challengeInputSpentController;
    PaymentProcessInFlightExit.Controller internal processInflightExitController;
    PaymentChallengeIFEOutputSpent.Controller internal challengeOutputSpentController;

    constructor(
        PlasmaFramework framework,
        EthVault ethVault,
        Erc20Vault erc20Vault,
        OutputGuardHandlerRegistry outputGuardHandlerRegistry,
        SpendingConditionRegistry spendingConditionRegistry,
        IStateTransitionVerifier verifier,
        uint256 supportedTxType
    )
        public
    {
        startInFlightExitController = PaymentStartInFlightExit.buildController(
            framework,
            outputGuardHandlerRegistry,
            spendingConditionRegistry,
            verifier,
            supportedTxType
        );

        piggybackInFlightExitController = PaymentPiggybackInFlightExit.buildController(
            framework,
            this,
            outputGuardHandlerRegistry
        );

        challengeCanonicityController = PaymentChallengeIFENotCanonical.buildController(
            framework,
            spendingConditionRegistry,
            outputGuardHandlerRegistry,
            supportedTxType
        );
        
        challengeInputSpentController = PaymentChallengeIFEInputSpent.buildController(
            framework,
            spendingConditionRegistry,
            outputGuardHandlerRegistry
        );

        challengeOutputSpentController = PaymentChallengeIFEOutputSpent.Controller(
            framework,
            spendingConditionRegistry,
            outputGuardHandlerRegistry
        );

        processInflightExitController = PaymentProcessInFlightExit.Controller({
            framework: framework,
            ethVault: ethVault,
            erc20Vault: erc20Vault
        });
    }

    function inFlightExits(uint192 _exitId) public view returns (PaymentExitDataModel.InFlightExit memory) {
        return inFlightExitMap.exits[_exitId];
    }

    /**
     * @notice Starts withdrawal from a transaction that might be in-flight.
     * @param args input argument data to challenge. See struct 'StartExitArgs' for detailed info.
     */
    function startInFlightExit(PaymentInFlightExitRouterArgs.StartExitArgs memory args)
        public
        payable
        onlyWithValue(IN_FLIGHT_EXIT_BOND)
    {
        startInFlightExitController.run(inFlightExitMap, args);
    }

    /**
     * @notice Piggyback on an input of an in-flight exiting tx. Would be processed if the in-flight exit is non-canonical.
     * @param args input argument data to piggyback. See struct 'PiggybackInFlightExitOnInputArgs' for detailed info.
     */
    function piggybackInFlightExitOnInput(
        PaymentInFlightExitRouterArgs.PiggybackInFlightExitOnInputArgs memory args
    )
        public
        payable
        onlyWithValue(PIGGYBACK_BOND)
    {
        piggybackInFlightExitController.piggybackInput(inFlightExitMap, args);
    }

    /**
     * @notice Piggyback on an output of an in-flight exiting tx. Would be processed if the in-flight exit is canonical.
     * @param args input argument data to piggyback. See struct 'PiggybackInFlightExitOnOutputArgs' for detailed info.
     */
    function piggybackInFlightExitOnOutput(
        PaymentInFlightExitRouterArgs.PiggybackInFlightExitOnOutputArgs memory args
    )
        public
        payable
        onlyWithValue(PIGGYBACK_BOND)
    {
        piggybackInFlightExitController.piggybackOutput(inFlightExitMap, args);
    }

    /**
     * @notice Challenges an in-flight exit to be non canonical.
     * @param args input argument data to challenge. See struct 'ChallengeCanonicityArgs' for detailed info.
     */
    function challengeInFlightExitNotCanonical(PaymentInFlightExitRouterArgs.ChallengeCanonicityArgs memory args)
        public
    {
        challengeCanonicityController.challenge(inFlightExitMap, args);
    }

    function respondToNonCanonicalChallenge(
        bytes memory inFlightTx,
        uint256 inFlightTxPos,
        bytes memory inFlightTxInclusionProof
    )
        public
    {
        challengeCanonicityController.respond(inFlightExitMap, inFlightTx, inFlightTxPos, inFlightTxInclusionProof);
    }

    function challengeInFlightExitInputSpent(PaymentInFlightExitRouterArgs.ChallengeInputSpentArgs memory args)
        public
    {
        challengeInputSpentController.run(inFlightExitMap, args);
    }

     /**
     * @notice Challenges an exit from in-flight transaction output.
     * @param args argument data to challenge. See struct 'ChallengeOutputSpent' for detailed info.
     */
    function challengeInFlightExitOutputSpent(PaymentInFlightExitRouterArgs.ChallengeOutputSpent memory args)
        public
    {
        challengeOutputSpentController.run(inFlightExitMap, args);
    }

    /**
     * @notice Process in-flight exit.
     * @dev This function is designed to be called in the main processExit function. Thus using internal.
     * @param exitId The in-flight exit id.
     * @param token The token (in erc20 address or address(0) for ETH) of the exiting output.
     */
    function processInFlightExit(uint192 exitId, address token) internal {
        processInflightExitController.run(inFlightExitMap, exitId, token);
    }
}
