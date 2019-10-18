pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../../../src/exits/payment/routers/PaymentStandardExitRouter.sol";
import "../../../../src/exits/payment/routers/PaymentStandardExitRouterArgs.sol";
import "../../../../src/framework/PlasmaFramework.sol";

contract PaymentStandardExitRouterMock is PaymentStandardExitRouter {
    PlasmaFramework private framework;

    PaymentStandardExitRouterArgs.StartStandardExitArgs private startStandardExitArgs;
    PaymentStandardExitRouterArgs.ChallengeStandardExitArgs private challengeStandardExitArgs;

    constructor(
        PlasmaFramework plasmaFramework,
        uint256 ethVaultId,
        uint256 erc20VaultId,
        OutputGuardHandlerRegistry outputGuardHandlerRegistry,
        SpendingConditionRegistry spendingConditionRegistry,
        ITxFinalizationVerifier txFinalizationVerifier
    )
        public
        PaymentStandardExitRouter(
            plasmaFramework,
            ethVaultId,
            erc20VaultId,
            outputGuardHandlerRegistry,
            spendingConditionRegistry,
            txFinalizationVerifier
        )
    {
        framework = plasmaFramework;
    }

    /** override and calls processStandardExit for test */
    function processExit(uint160 exitId, uint256, address ercContract) external {
        PaymentStandardExitRouter.processStandardExit(exitId, ercContract);
    }

    /** helper functions for testing */
    function setExit(uint160 _exitId, PaymentExitDataModel.StandardExit memory _exitData) public {
        PaymentStandardExitRouter.standardExitMap.exits[_exitId] = _exitData;
    }

    function proxyFlagOutputSpent(bytes32 _outputId) public {
        framework.flagOutputSpent(_outputId);
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

    function stringEquals(string memory a, string memory b) private returns (bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }
}
