pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/exits/payment/routers/PaymentInFlightExitRouter.sol";
import "../../src/exits/payment/routers/PaymentInFlightExitRouterArgs.sol";

contract FallbackFunctionFailAttacker {
    function () external payable {
        revert('fail on fallback function');
    }
}
