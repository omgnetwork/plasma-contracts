pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../../../src/exits/payment/routers/PaymentStandardExitRouter.sol";
import "../../../../src/framework/PlasmaFramework.sol";
import "../../../../src/vaults/EthVault.sol";
import "../../../../src/vaults/Erc20Vault.sol";

contract PaymentStandardExitRouterMock is PaymentStandardExitRouter {
    PlasmaFramework private framework;

    constructor(
        PlasmaFramework _framework,
        EthVault _ethVault,
        Erc20Vault _erc20Vault,
        OutputGuardHandlerRegistry _outputGuardHandlerRegistry,
        PaymentSpendingConditionRegistry _spendingConditionRegistry
    )
        public
        PaymentStandardExitRouter(
            _framework,
            _ethVault,
            _erc20Vault,
            _outputGuardHandlerRegistry,
            _spendingConditionRegistry
        )
    {
        framework = _framework;
    }

    /** override and calls processStandardExit for test */
    function processExit(uint192 exitId, address ercContract) external {
        PaymentStandardExitRouter.processStandardExit(exitId, ercContract);
    }

    /** helper functions for testing */

    function setExit(uint192 _exitId, PaymentExitDataModel.StandardExit memory _exitData) public {
        PaymentStandardExitRouter.standardExitMap.exits[_exitId] = _exitData;
    }

    function proxyFlagOutputSpent(bytes32 _outputId) public {
        framework.flagOutputSpent(_outputId);
    }

    function depositFundForTest() public payable {}
}
