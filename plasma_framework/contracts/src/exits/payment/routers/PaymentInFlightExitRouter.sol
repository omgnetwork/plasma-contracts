pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./PaymentInFlightExitRouterArgs.sol";
import "../PaymentExitDataModel.sol";
import "../controllers/PaymentStartInFlightExit.sol";
import "../controllers/PaymentPiggybackInFlightExit.sol";
import "../controllers/PaymentChallengeIFENotCanonical.sol";
import "../controllers/PaymentChallengeIFEOutput.sol";
import "../spendingConditions/PaymentSpendingConditionRegistry.sol";
import "../../registries/OutputGuardHandlerRegistry.sol";
import "../../interfaces/IStateTransitionVerifier.sol";
import "../../../utils/OnlyWithValue.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../framework/interfaces/IExitProcessor.sol";

contract PaymentInFlightExitRouter is IExitProcessor, OnlyWithValue {
    using PaymentStartInFlightExit for PaymentStartInFlightExit.Controller;
    using PaymentPiggybackInFlightExit for PaymentPiggybackInFlightExit.Controller;
    using PaymentChallengeIFENotCanonical for PaymentChallengeIFENotCanonical.Controller;
    using PaymentChallengeIFEOutput for PaymentChallengeIFEOutput.Controller;

    uint256 public constant IN_FLIGHT_EXIT_BOND = 31415926535 wei;
    uint256 public constant PIGGYBACK_BOND = 31415926535 wei;

    PaymentExitDataModel.InFlightExitMap internal inFlightExitMap;
    PaymentStartInFlightExit.Controller internal startInFlightExitController;
    PaymentPiggybackInFlightExit.Controller internal piggybackInFlightExitController;
    PaymentChallengeIFENotCanonical.Controller internal challengeCanonicityController;
    PaymentChallengeIFEOutput.Controller internal challengeOutputController;

    constructor(
        PlasmaFramework framework,
        OutputGuardHandlerRegistry outputGuardHandlerRegistry,
        PaymentSpendingConditionRegistry spendingConditionRegistry,
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

        challengeCanonicityController = PaymentChallengeIFENotCanonical.Controller({
            framework: framework,
            spendingConditionRegistry: spendingConditionRegistry,
            supportedTxType: supportedTxType
        });

        challengeOutputController = PaymentChallengeIFEOutput.Controller({
            framework: framework,
            spendingConditionRegistry: spendingConditionRegistry,
            outputGuardHandlerRegistry: outputGuardHandlerRegistry
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

     /**
     * @notice Challenges an exit from in-flight transaction output.
     * @param args argument data to challenge. See struct 'ChallengeOutputSpent' for detailed info.
     */
    function challengeInFlightExitOutputSpent(PaymentInFlightExitRouterArgs.ChallengeOutputSpent memory args)
        public
    {
        challengeOutputController.run(inFlightExitMap, args);
    }
}
