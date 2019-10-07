pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/exits/payment/routers/PaymentInFlightExitRouter.sol";
import "../../src/exits/payment/routers/PaymentInFlightExitRouterArgs.sol";

contract PaymentIFEInputChallengeAttacker {

    bool private funded = false;
    PaymentInFlightExitRouter private router;
    PaymentInFlightExitRouterArgs.ChallengeInputSpentArgs private challengeArgs;

    constructor(PaymentInFlightExitRouter _router, PaymentInFlightExitRouterArgs.ChallengeInputSpentArgs memory _challengeArgs) public {
        router = _router;
        challengeArgs = _challengeArgs;
    }

    /* solhint-disable no-complex-fallback */
    function () external payable {
        if (funded) {
            router.challengeInFlightExitInputSpent(challengeArgs);
        }
        funded = true;
    }
}
