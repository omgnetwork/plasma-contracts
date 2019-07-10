pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../../src/exits/payment/PaymentStandardExitable.sol";

contract PaymentStandardExitableMock is PaymentStandardExitable {
    constructor(address _framework) public PaymentStandardExitable(_framework) {}

    // to make contract not abstract
    function processExit(uint256 _exitId) external {}

    /** helper functions for testing */

    function setExit(uint192 _exitId, PaymentExitDataModel.StandardExit memory _exitData) public {
        PaymentStandardExitable.exits[_exitId] = _exitData;
    }

    function depositFundForTest() public payable {}
}
