pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./PaymentInFlightExitRouterArgs.sol";
import "../PaymentExitDataModel.sol";
import "../controllers/PaymentStartInFlightExit.sol";
import "../controllers/PaymentChallengeInFlightExitNotCanonical.sol";
import "../spendingConditions/PaymentSpendingConditionRegistry.sol";
import "../../../utils/OnlyWithValue.sol";
import "../../../framework/PlasmaFramework.sol";

contract PaymentInFlightExitRouter is OnlyWithValue {
    using PaymentStartInFlightExit for PaymentStartInFlightExit.Controller;
    using PaymentChallengeInFlightExitNotCanonical for PaymentChallengeInFlightExitNotCanonical.Controller;

    uint256 public constant IN_FLIGHT_EXIT_BOND = 31415926535 wei;

    PaymentExitDataModel.InFlightExitMap inFlightExitMap;
    PaymentStartInFlightExit.Controller startInFlightExitController;
    PaymentChallengeInFlightExitNotCanonical.Controller challengeCanonicityController;

    constructor(PlasmaFramework _framework, PaymentSpendingConditionRegistry spendingConditionRegistry) public {
        startInFlightExitController = PaymentStartInFlightExit.buildController(_framework, spendingConditionRegistry);

        challengeCanonicityController = PaymentChallengeInFlightExitNotCanonical.Controller(
            _framework, spendingConditionRegistry
        );
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
