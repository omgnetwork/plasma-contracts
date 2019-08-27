pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../../../src/exits/payment/routers/PaymentInFlightExitRouter.sol";
import "../../../../src/framework/PlasmaFramework.sol";
import "../../../../src/exits/interfaces/IStateTransitionVerifier.sol";
import "../../../../src/exits/payment/PaymentExitDataModel.sol";

contract PaymentInFlightExitRouterMock is PaymentInFlightExitRouter {
    constructor(PlasmaFramework framework, PaymentSpendingConditionRegistry registry, IStateTransitionVerifier verifier)
        public
        PaymentInFlightExitRouter(framework, registry, verifier) {
    }

    // to override IExitProcessor function
    function processExit(uint192 exitId) external {}

    function finalizeExit(uint192 exitId) public {
        inFlightExitMap.exits[exitId].exitStartTimestamp = 1;
        inFlightExitMap.exits[exitId].exitMap = Bits.setBit(inFlightExitMap.exits[exitId].exitMap, 255);
    }

    function getInFlightExitInput(uint192 exitId, uint16 inputIndex) public view returns (PaymentExitDataModel.WithdrawData memory) {
        return inFlightExitMap.exits[exitId].inputs[inputIndex];
    }

    function getInFlightExitOutput(uint192 exitId, uint16 outputIndex) public view returns (PaymentExitDataModel.WithdrawData memory) {
        return inFlightExitMap.exits[exitId].outputs[outputIndex];
    }
}
