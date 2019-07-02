pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./PaymentStandardExitable.sol";
import "../../framework/interfaces/IExitProcessor.sol";

contract PaymentExitGame is IExitProcessor, PaymentStandardExitable {
    constructor(address _framework) public PaymentStandardExitable(_framework) {}

    function processExit(uint256 _exitId) external {
        // TODO: implement this
    }
}
