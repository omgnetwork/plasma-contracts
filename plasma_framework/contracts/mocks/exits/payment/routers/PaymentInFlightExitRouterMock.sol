pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../../../src/exits/payment/PaymentExitDataModel.sol";
import "../../../../src/exits/payment/routers/PaymentInFlightExitRouter.sol";
import "../../../../src/framework/PlasmaFramework.sol";
import "../../../../src/exits/interfaces/IStateTransitionVerifier.sol";
import "../../../../src/exits/registries/OutputGuardHandlerRegistry.sol";
import "../../../../src/exits/payment/PaymentInFlightExitModelUtils.sol";

contract PaymentInFlightExitRouterMock is PaymentInFlightExitRouter {
    using PaymentInFlightExitModelUtils for PaymentExitDataModel.InFlightExit;

    PlasmaFramework public framework;

    constructor(
        PlasmaFramework plasmaFramework,
        EthVault ethVault,
        Erc20Vault erc20Vault,
        OutputGuardHandlerRegistry outputGuardHandlerRegistry,
        SpendingConditionRegistry spendingConditionRegistry,
        IStateTransitionVerifier verifier,
        uint256 supportedTxType
    )
        public
        PaymentInFlightExitRouter(
            plasmaFramework,
            ethVault,
            erc20Vault,
            outputGuardHandlerRegistry,
            spendingConditionRegistry,
            verifier,
            supportedTxType
        )
    {
        framework = plasmaFramework;
    }

    /** override and calls processInFlightExit for test */
    function processExit(uint192 exitId, address ercContract) external {
        PaymentInFlightExitRouter.processInFlightExit(exitId, ercContract);
    }

    function setInFlightExit(uint192 exitId, PaymentExitDataModel.InFlightExit memory exit) public {
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

    function getInFlightExitInput(uint192 exitId, uint16 inputIndex) public view returns (PaymentExitDataModel.WithdrawData memory) {
        return inFlightExitMap.exits[exitId].inputs[inputIndex];
    }

    function setInFlightExitInputPiggybacked(uint192 exitId, uint16 inputIndex) public payable {
        inFlightExitMap.exits[exitId].setInputPiggybacked(inputIndex);
    }

    function getInFlightExitOutput(uint192 exitId, uint16 outputIndex) public view returns (PaymentExitDataModel.WithdrawData memory) {
        return inFlightExitMap.exits[exitId].outputs[outputIndex];
    }

    /** calls the flagOutputSpent function on behalf of the exit game */
    function proxyFlagOutputSpent(bytes32 _outputId) public {
        framework.flagOutputSpent(_outputId);
    }

    /** empty function that accepts ETH to fund the contract as test setup */
    function depositFundForTest() public payable {}
}
