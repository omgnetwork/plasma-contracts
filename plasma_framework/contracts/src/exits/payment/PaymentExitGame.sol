pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./routers/PaymentStandardExitRouter.sol";
import "../utils/ExitIdLib.sol";
import "../../framework/interfaces/IExitProcessor.sol";
import "../../framework/PlasmaFramework.sol";
import "../../vaults/EthVault.sol";
import "../../vaults/Erc20Vault.sol";

contract PaymentExitGame is IExitProcessor, PaymentStandardExitRouter {
    constructor(
        PlasmaFramework _framework,
        EthVault _ethVault,
        Erc20Vault _erc20Vault,
        OutputGuardHandlerRegistry _outputGuardHandlerRegistry,
        PaymentSpendingConditionRegistry _spendingConditionRegistry
    )
        public
        PaymentStandardExitRouter(_framework, _ethVault, _erc20Vault, _outputGuardHandlerRegistry, _spendingConditionRegistry) {
    }

    function processExit(uint192 _exitId) external {
        if (ExitIdLib.isStandardExit(_exitId)) {
            PaymentStandardExitRouter.processStandardExit(_exitId);
        } else {
            require(false, "TODO: implement process in flight exit");
        }
    }
}
