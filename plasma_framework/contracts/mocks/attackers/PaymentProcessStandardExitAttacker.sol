pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/exits/payment/routers/PaymentStandardExitRouter.sol";

contract PaymentProcessStandardExitAttacker {

    bool private funded = false;
    PaymentStandardExitRouter private router;
    uint160 private exitId;
    address private token;

    constructor(PaymentStandardExitRouter _router, uint160 _exitId, address _token) public {
        router = _router;
        exitId = _exitId;
        token = _token;
    }

    /* solhint-disable no-complex-fallback */
    function () external payable {
        if (funded) {
            router.processExit(exitId, 0, token);
        }
        funded = true;
    }
}
