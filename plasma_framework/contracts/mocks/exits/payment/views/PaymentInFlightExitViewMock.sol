pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../../../src/exits/payment/views/PaymentInFlightExitView.sol";
import "../../../../src/framework/PlasmaFramework.sol";
import "../../../../src/transactions/outputs/PaymentOutputModel.sol";

contract PaymentInFlightExitViewMock is PaymentInFlightExitView {
    constructor(PlasmaFramework _framework, PaymentSpendingConditionRegistry _registry)
        public
        PaymentInFlightExitView(_framework, _registry) {
    }

    // to override IExitProcessor function
    function processExit(uint192 exitId) external {}

    function finalizeExit(uint192 exitId) public {
        inFlightExitMap.exits[exitId].exitStartTimestamp = 1;
        inFlightExitMap.exits[exitId].exitMap = Bits.setBit(inFlightExitMap.exits[exitId].exitMap, 255);
    }

    function getInFlightExitInput(uint192 exitId, uint8 inputIndex) public view returns (PaymentOutputModel.Output memory) {
        return inFlightExitMap.exits[exitId].inputs[inputIndex];
    }

    function getInFlightExitOutput(uint192 exitId, uint8 outputIndex) public view returns (PaymentOutputModel.Output memory) {
        return inFlightExitMap.exits[exitId].outputs[outputIndex];
    }
}
