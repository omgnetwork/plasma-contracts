pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../../../src/exits/payment/PaymentExitGameArgs.sol";
import "../../../../src/exits/payment/routers/PaymentStandardExitRouter.sol";
import "../../../../src/exits/payment/routers/PaymentStandardExitRouterArgs.sol";
import "../../../../src/framework/PlasmaFramework.sol";

contract PaymentStandardExitRouterMock is PaymentStandardExitRouter {
    PlasmaFramework private framework;

    PaymentStandardExitRouterArgs.StartStandardExitArgs private startStandardExitArgs;
    PaymentStandardExitRouterArgs.ChallengeStandardExitArgs private challengeStandardExitArgs;

    constructor(PaymentExitGameArgs.Args memory args)
        public
        PaymentStandardExitRouter(args)
    {
        framework = args.framework;
    }

    /** override and calls processStandardExit for test */
    function processExit(uint168 exitId, uint256, address ercContract) external {
        PaymentStandardExitRouter.processStandardExit(exitId, ercContract);
    }

    /** helper functions for testing */
    function setExit(uint168 exitId, PaymentExitDataModel.StandardExit memory exitData) public {
        PaymentStandardExitRouter.standardExitMap.exits[exitId] = exitData;
    }

    function proxyFlagOutputFinalized(bytes32 outputId, uint168 exitId) public {
        framework.flagOutputFinalized(outputId, exitId);
    }

    function depositFundForTest() public payable {}

    /**
     * This function helps test reentrant by making this function itself the first call with 'nonReentrant' protection
     * So all other PaymentExitGame functions that is protected by 'nonReentrant' too would fail as it would be considered as re-entrancy
     */
    function testNonReentrant(string memory testTarget) public nonReentrant(framework) {
        if (stringEquals(testTarget, "startStandardExit")) {
            PaymentStandardExitRouter.startStandardExit(startStandardExitArgs);
        } else if (stringEquals(testTarget, "challengeStandardExit")) {
            PaymentStandardExitRouter.challengeStandardExit(challengeStandardExitArgs);
        }
    }

    function stringEquals(string memory a, string memory b) private pure returns (bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }
}
