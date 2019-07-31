pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../../src/exits/payment/PaymentInFlightExitable.sol";
import "../../../src/framework/PlasmaFramework.sol";
import "../../../src/transactions/outputs/PaymentOutputModel.sol";

contract PaymentInFlightExitableMock is PaymentInFlightExitable {
    constructor(PlasmaFramework _framework) public PaymentInFlightExitable(_framework) {}

    // to override IExitProcessor function
    function processExit(uint192 exitId) external {}

    function finalizeExit(uint192 exitId) public {
        inFlightExits[exitId].exitStartTimestamp = 1;
        inFlightExits[exitId].exitMap = Bits.setBit(inFlightExits[exitId].exitMap, 255);
    }

    function getInFlightExitInput(uint192 exitId, uint8 inputIndex) public view returns (PaymentOutputModel.Output memory) {
        return inFlightExits[exitId].inputs[inputIndex];
    }

    function getInFlightExitOutput(uint192 exitId, uint8 outputIndex) public view returns (PaymentOutputModel.Output memory) {
        return inFlightExits[exitId].outputs[outputIndex];
    }
}
