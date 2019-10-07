pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/exits/payment/routers/PaymentStandardExitRouter.sol";
import "../../src/exits/payment/routers/PaymentStandardExitRouterArgs.sol";

contract PaymentStandardExitChallengeAttacker {

    bool private funded = false;
    PaymentStandardExitRouter private router;
    PaymentStandardExitRouterArgs.ChallengeStandardExitArgs private challengeArgs;

    constructor(PaymentStandardExitRouter _router, PaymentStandardExitRouterArgs.ChallengeStandardExitArgs memory _challengeArgs) public {
        router = _router;
        challengeArgs = _challengeArgs;
    }

    /* solhint-disable no-complex-fallback */
    function () external payable {
        if (funded) {
            router.challengeStandardExit(challengeArgs);
        }
        funded = true;
    }
}
