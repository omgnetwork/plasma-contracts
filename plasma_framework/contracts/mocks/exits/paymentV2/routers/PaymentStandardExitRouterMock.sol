pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../../../src/exits/paymentV2/PaymentV2ExitGameArgs.sol";
import "../../../../src/exits/paymentV2/routers/PaymentV2StandardExitRouter.sol";
import "../../../../src/exits/paymentV2/routers/PaymentV2StandardExitRouterArgs.sol";
import "../../../../src/framework/PlasmaFramework.sol";

contract PaymentV2StandardExitRouterMock is PaymentV2StandardExitRouter {
    PlasmaFramework private framework;

    PaymentV2StandardExitRouterArgs.StartStandardExitArgs private startStandardExitArgs;
    PaymentV2StandardExitRouterArgs.ChallengeStandardExitArgs private challengeStandardExitArgs;

    constructor(PaymentV2ExitGameArgs.Args memory args)
        public
        PaymentV2StandardExitRouter(args)
    {
        framework = args.framework;
    }

    /** override and calls processStandardExit for test */
    function processExit(uint160 exitId, uint256, address ercContract) external {
        PaymentV2StandardExitRouter.processStandardExit(exitId, ercContract);
    }

    /** helper functions for testing */
    function setExit(uint160 exitId, PaymentV2ExitDataModel.StandardExit memory exitData) public {
        PaymentV2StandardExitRouter.standardExitMap.exits[exitId] = exitData;
    }

    function proxyFlagOutputFinalized(bytes32 outputId, uint160 exitId) public {
        framework.flagOutputFinalized(outputId, exitId);
    }

    function depositFundForTest() public payable {}

    /**
     * This function helps test reentrant by making this function itself the first call with 'nonReentrant' protection
     * So all other PaymentExitGame functions that is protected by 'nonReentrant' too would fail as it would be considered as re-entrancy
     */
    function testNonReentrant(string memory testTarget) public nonReentrant(framework) {
        if (stringEquals(testTarget, "startStandardExit")) {
            PaymentV2StandardExitRouter.startStandardExit(startStandardExitArgs);
        } else if (stringEquals(testTarget, "challengeStandardExit")) {
            PaymentV2StandardExitRouter.challengeStandardExit(challengeStandardExitArgs);
        }
    }

    function stringEquals(string memory a, string memory b) private pure returns (bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }
}
