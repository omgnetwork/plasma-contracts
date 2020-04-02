pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../../../src/exits/paymentV2/PaymentV2ExitDataModel.sol";
import "../../../../src/exits/paymentV2/PaymentV2InFlightExitModelUtils.sol";
import "../../../../src/exits/paymentV2/routers/PaymentV2InFlightExitRouter.sol";
import "../../../../src/exits/paymentV2/routers/PaymentV2InFlightExitRouterArgs.sol";
import "../../../../src/framework/PlasmaFramework.sol";
import "../../../../src/exits/interfaces/IStateTransitionVerifier.sol";

import "../../../../src/utils/FailFastReentrancyGuard.sol";

contract PaymentV2InFlightExitRouterMock is FailFastReentrancyGuard, PaymentV2InFlightExitRouter {
    using PaymentV2InFlightExitModelUtils for PaymentV2ExitDataModel.InFlightExit;

    PlasmaFramework public framework;

    PaymentV2InFlightExitRouterArgs.StartExitArgs private startIfeArgs;
    PaymentV2InFlightExitRouterArgs.PiggybackInFlightExitOnInputArgs private piggybackInputArgs;
    PaymentV2InFlightExitRouterArgs.PiggybackInFlightExitOnOutputArgs private piggybackOutputArgs;
    PaymentV2InFlightExitRouterArgs.ChallengeCanonicityArgs private challengeCanonicityArgs;
    PaymentV2InFlightExitRouterArgs.ChallengeInputSpentArgs private challengeInputSpentArgs;
    PaymentV2InFlightExitRouterArgs.ChallengeOutputSpent private challengeOutputSpentArgs;

    constructor(PaymentV2ExitGameArgs.Args memory args)
        public
        PaymentV2InFlightExitRouter(args)
    {
        framework = args.framework;
    }

    /** override and calls processInFlightExit for test */
    function processExit(uint160 exitId, uint256, address ercContract) external {
        PaymentV2InFlightExitRouter.processInFlightExit(exitId, ercContract);
    }

    function setInFlightExit(uint160 exitId, PaymentV2ExitDataModel.InFlightExit memory exit) public {
        PaymentV2ExitDataModel.InFlightExit storage ife = inFlightExitMap.exits[exitId];
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

    function getInFlightExitInput(uint160 exitId, uint16 inputIndex) public view returns (PaymentV2ExitDataModel.WithdrawData memory) {
        return inFlightExitMap.exits[exitId].inputs[inputIndex];
    }

    function setInFlightExitInputPiggybacked(uint160 exitId, uint16 inputIndex) public payable {
        inFlightExitMap.exits[exitId].setInputPiggybacked(inputIndex);
    }

    function setInFlightExitOutputPiggybacked(uint160 exitId, uint16 outputIndex) public payable {
        inFlightExitMap.exits[exitId].setOutputPiggybacked(outputIndex);
    }

    function getInFlightExitOutput(uint160 exitId, uint16 outputIndex) public view returns (PaymentV2ExitDataModel.WithdrawData memory) {
        return inFlightExitMap.exits[exitId].outputs[outputIndex];
    }

    /** calls the flagOutputFinalized function on behalf of the exit game */
    function proxyFlagOutputFinalized(bytes32 outputId, uint160 exitId) public {
        framework.flagOutputFinalized(outputId, exitId);
    }

    /**
     * This function helps test reentrant by making this function itself the first call with 'nonReentrant' protection
     * So all other PaymentExitGame functions that is protected by 'nonReentrant' too would fail as it would be considered as re-entrancy
     */
    function testNonReentrant(string memory testTarget) public nonReentrant(framework) {
        if (stringEquals(testTarget, "startInFlightExit")) {
            PaymentV2InFlightExitRouter.startInFlightExit(startIfeArgs);
        } else if (stringEquals(testTarget, "piggybackInFlightExitOnInput")) {
            PaymentV2InFlightExitRouter.piggybackInFlightExitOnInput(piggybackInputArgs);
        } else if (stringEquals(testTarget, "piggybackInFlightExitOnOutput")) {
            PaymentV2InFlightExitRouter.piggybackInFlightExitOnOutput(piggybackOutputArgs);
        } else if (stringEquals(testTarget, "challengeInFlightExitNotCanonical")) {
            PaymentV2InFlightExitRouter.challengeInFlightExitNotCanonical(challengeCanonicityArgs);
        } else if (stringEquals(testTarget, "respondToNonCanonicalChallenge")) {
            PaymentV2InFlightExitRouter.respondToNonCanonicalChallenge(bytes(""), 0, bytes(""));
        } else if (stringEquals(testTarget, "challengeInFlightExitInputSpent")) {
            PaymentV2InFlightExitRouter.challengeInFlightExitInputSpent(challengeInputSpentArgs);
        } else if (stringEquals(testTarget, "challengeInFlightExitOutputSpent")) {
            PaymentV2InFlightExitRouter.challengeInFlightExitOutputSpent(challengeOutputSpentArgs);
        } else if (stringEquals(testTarget, "deleteNonPiggybackedInFlightExit")) {
            PaymentV2InFlightExitRouter.deleteNonPiggybackedInFlightExit(uint160(0));
        }

        revert("non defined function");
    }

    /** empty function that accepts ETH to fund the contract as test setup */
    function depositFundForTest() public payable {}

    function stringEquals(string memory a, string memory b) private pure returns (bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }
}
