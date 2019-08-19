pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./PaymentInFlightExitRouterArgs.sol";
import "../PaymentExitDataModel.sol";
import "../controllers/PaymentStartInFlightExitController.sol";
import "../spendingConditions/PaymentSpendingConditionRegistry.sol";
import "../../../utils/OnlyWithValue.sol";
import "../../../framework/PlasmaFramework.sol";

contract PaymentInFlightExitRouter is OnlyWithValue {
    using PaymentStartInFlightExitController for PaymentStartInFlightExitController.Object;

    uint256 public constant IN_FLIGHT_EXIT_BOND = 31415926535 wei;

    PaymentExitDataModel.InFlightExitMap inFlightExitMap;
    PaymentStartInFlightExitController.Object startInFlightExitController;

    constructor(PlasmaFramework _framework, PaymentSpendingConditionRegistry spendingConditionRegistry) public {
        startInFlightExitController = PaymentStartInFlightExitController.init(_framework, spendingConditionRegistry);
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
}
