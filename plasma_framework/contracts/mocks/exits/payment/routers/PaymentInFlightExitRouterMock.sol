pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../../../src/exits/payment/PaymentExitDataModel.sol";
import "../../../../src/exits/payment/routers/PaymentInFlightExitRouter.sol";
import "../../../../src/exits/payment/routers/PaymentInFlightExitRouterArgs.sol";
import "../../../../src/framework/PlasmaFramework.sol";
import "../../../../src/exits/interfaces/IStateTransitionVerifier.sol";
import "../../../../src/exits/registries/OutputGuardHandlerRegistry.sol";
import "../../../../src/exits/payment/PaymentInFlightExitModelUtils.sol";

import "../../../../src/utils/FailFastReentrancyGuard.sol";

contract PaymentInFlightExitRouterMock is FailFastReentrancyGuard, PaymentInFlightExitRouter {
    using PaymentInFlightExitModelUtils for PaymentExitDataModel.InFlightExit;

    PlasmaFramework public framework;

    PaymentInFlightExitRouterArgs.StartExitArgs private startIfeArgs;
    PaymentInFlightExitRouterArgs.PiggybackInFlightExitOnInputArgs private piggybackInputArgs;
    PaymentInFlightExitRouterArgs.PiggybackInFlightExitOnOutputArgs private piggybackOutputArgs;
    PaymentInFlightExitRouterArgs.ChallengeCanonicityArgs private challengeCanonicityArgs;
    PaymentInFlightExitRouterArgs.ChallengeInputSpentArgs private challengeInputSpentArgs;
    PaymentInFlightExitRouterArgs.ChallengeOutputSpent private challengeOutputSpentArgs;

    constructor(
        PlasmaFramework plasmaFramework,
        uint256 ethVaultId,
        uint256 erc20VaultId,
        OutputGuardHandlerRegistry outputGuardHandlerRegistry,
        SpendingConditionRegistry spendingConditionRegistry,
        IStateTransitionVerifier stateTransitionVerifier,
        ITxFinalizationVerifier txFinalizationVerifier,
        uint256 supportedTxType
    )
        public
        PaymentInFlightExitRouter(
            plasmaFramework,
            ethVaultId,
            erc20VaultId,
            outputGuardHandlerRegistry,
            spendingConditionRegistry,
            stateTransitionVerifier,
            txFinalizationVerifier,
            supportedTxType
        )
    {
        framework = plasmaFramework;
    }

    /** override and calls processInFlightExit for test */
    function processExit(uint160 exitId, uint256, address ercContract) external {
        PaymentInFlightExitRouter.processInFlightExit(exitId, ercContract);
    }

    function setInFlightExit(uint160 exitId, PaymentExitDataModel.InFlightExit memory exit) public {
        PaymentExitDataModel.InFlightExit storage ife = inFlightExitMap.exits[exitId];
        ife.isCanonical = exit.isCanonical;
        ife.exitStartTimestamp = exit.exitStartTimestamp;
        ife.exitMap = exit.exitMap;
        ife.position = exit.position;
        ife.bondOwner = exit.bondOwner;
        ife.bondSize = exit.bondSize;
        ife.oldestCompetitorPosition = exit.oldestCompetitorPosition;

        for (uint i = 0; i < exit.inputs.length; i++) {
            ife.inputs[i] = exit.inputs[i];
        }

        for (uint i = 0; i < exit.outputs.length; i++) {
            ife.outputs[i] = exit.outputs[i];
        }
    }

    function getInFlightExitInput(uint160 exitId, uint16 inputIndex) public view returns (PaymentExitDataModel.WithdrawData memory) {
        return inFlightExitMap.exits[exitId].inputs[inputIndex];
    }

    function setInFlightExitInputPiggybacked(uint160 exitId, uint16 inputIndex) public payable {
        inFlightExitMap.exits[exitId].setInputPiggybacked(inputIndex);
    }

    function getInFlightExitOutput(uint160 exitId, uint16 outputIndex) public view returns (PaymentExitDataModel.WithdrawData memory) {
        return inFlightExitMap.exits[exitId].outputs[outputIndex];
    }

    /** calls the flagOutputSpent function on behalf of the exit game */
    function proxyFlagOutputSpent(bytes32 _outputId) public {
        framework.flagOutputSpent(_outputId);
    }

    /**
     * This function helps test reentrant by making this function itself the first call with 'nonReentrant' protection
     * So all other PaymentExitGame functions that is protected by 'nonReentrant' too would fail as it would be considered as re-entrancy
     */
    function testNonReentrant(string memory testTarget) public nonReentrant(framework) {
        if (stringEquals(testTarget, "startInFlightExit")) {
            PaymentInFlightExitRouter.startInFlightExit(startIfeArgs);
        } else if (stringEquals(testTarget, "piggybackInFlightExitOnInput")) {
            PaymentInFlightExitRouter.piggybackInFlightExitOnInput(piggybackInputArgs);
        } else if (stringEquals(testTarget, "piggybackInFlightExitOnOutput")) {
            PaymentInFlightExitRouter.piggybackInFlightExitOnOutput(piggybackOutputArgs);
        } else if (stringEquals(testTarget, "challengeInFlightExitNotCanonical")) {
            PaymentInFlightExitRouter.challengeInFlightExitNotCanonical(challengeCanonicityArgs);
        } else if (stringEquals(testTarget, "respondToNonCanonicalChallenge")) {
            PaymentInFlightExitRouter.respondToNonCanonicalChallenge(bytes(""), 0, bytes(""));
        } else if (stringEquals(testTarget, "challengeInFlightExitInputSpent")) {
            PaymentInFlightExitRouter.challengeInFlightExitInputSpent(challengeInputSpentArgs);
        } else if (stringEquals(testTarget, "challengeInFlightExitOutputSpent")) {
            PaymentInFlightExitRouter.challengeInFlightExitOutputSpent(challengeOutputSpentArgs);
        }
    }

    /** empty function that accepts ETH to fund the contract as test setup */
    function depositFundForTest() public payable {}

    function stringEquals(string memory a, string memory b) private returns (bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }
}
