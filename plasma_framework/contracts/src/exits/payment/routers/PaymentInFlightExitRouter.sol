pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./PaymentInFlightExitRouterArgs.sol";
import "../PaymentExitDataModel.sol";
import "../controllers/PaymentStartInFlightExit.sol";
import "../controllers/PaymentChallengeIFENotCanonical.sol";
import "../spendingConditions/PaymentSpendingConditionRegistry.sol";
import "../../registries/OutputGuardHandlerRegistry.sol";
import "../../interfaces/IStateTransitionVerifier.sol";
import "../../../utils/OnlyWithValue.sol";
import "../../../framework/PlasmaFramework.sol";

contract PaymentInFlightExitRouter is OnlyWithValue {
    using PaymentStartInFlightExit for PaymentStartInFlightExit.Controller;
    using PaymentChallengeIFENotCanonical for PaymentChallengeIFENotCanonical.Controller;

    uint256 public constant IN_FLIGHT_EXIT_BOND = 31415926535 wei;

    PaymentExitDataModel.InFlightExitMap inFlightExitMap;
    PaymentStartInFlightExit.Controller startInFlightExitController;
    PaymentChallengeIFENotCanonical.Controller challengeCanonicityController;

    constructor(
        PlasmaFramework framework,
        PaymentSpendingConditionRegistry spendingConditionRegistry,
        IStateTransitionVerifier verifier,
        OutputGuardHandlerRegistry outputGuardHandlerRegistry,
        uint256 supportedTxType
    )
        public
    {
        startInFlightExitController = PaymentStartInFlightExit.buildController(
            framework,
            spendingConditionRegistry,
            verifier,
            outputGuardHandlerRegistry
        );

        challengeCanonicityController = PaymentChallengeIFENotCanonical.Controller({
            framework: framework,
            spendingConditionRegistry: spendingConditionRegistry,
            supportedTxType: supportedTxType
        });
    }

    function inFlightExits(uint192 _exitId) public view returns (PaymentExitDataModel.InFlightExit memory) {
        return inFlightExitMap.exits[_exitId];
    }

    /**
     * @notice Starts withdrawal from a transaction that might be in-flight.
     * @dev requires the exiting UTXO's token to be added via 'addToken'
     * @dev Uses struct as input because too many variables and failed to compile.
     * @dev Uses public instead of external because ABIEncoder V2 does not support struct calldata + external
     * @param args input argument data to challenge. See struct 'StartExitArgs' for detailed info.
     */
    function startInFlightExit(PaymentInFlightExitRouterArgs.StartExitArgs memory args)
        public
        payable
        onlyWithValue(IN_FLIGHT_EXIT_BOND)
    {
        startInFlightExitController.run(inFlightExitMap, args);
    }

    function challengeInFlightExitNotCanonical(PaymentInFlightExitRouterArgs.ChallengeCanonicityArgs memory args)
        public
        payable
    {
        challengeCanonicityController.run(inFlightExitMap, args);
    }
}
