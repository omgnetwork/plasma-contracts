pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../../../src/exits/payment/routers/PaymentStandardExitRouter.sol";
import "../../../../src/framework/PlasmaFramework.sol";
import "../../../../src/vaults/EthVault.sol";
import "../../../../src/vaults/Erc20Vault.sol";

contract PaymentStandardExitRouterMock is PaymentStandardExitRouter {
    PlasmaFramework private framework;

    constructor(
        PlasmaFramework plasmaFramework,
        EthVault ethVault,
        Erc20Vault erc20Vault,
        OutputGuardHandlerRegistry outputGuardHandlerRegistry,
        SpendingConditionRegistry spendingConditionRegistry,
        ITxFinalizationVerifier txFinalizationVerifier
    )
        public
        PaymentStandardExitRouter(
            framework,
            ethVault,
            erc20Vault,
            outputGuardHandlerRegistry,
            spendingConditionRegistry,
            txFinalizationVerifier
        )
    {
        framework = plasmaFramework;
    }

    /** override and calls processStandardExit for test */
    function processExit(uint160 exitId, address ercContract) external {
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
}
