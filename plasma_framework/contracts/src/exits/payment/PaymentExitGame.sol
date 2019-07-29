pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./PaymentStandardExitable.sol";
import "../utils/ExitId.sol";
import "../../framework/interfaces/IExitProcessor.sol";
import "../../framework/PlasmaFramework.sol";
import "../../vaults/EthVault.sol";
import "../../vaults/Erc20Vault.sol";

contract PaymentExitGame is IExitProcessor, PaymentStandardExitable {
    constructor(PlasmaFramework _framework, EthVault _ethVault, Erc20Vault _erc20Vault)
        public
        PaymentStandardExitable(_framework, _ethVault, _erc20Vault) {
    }

    function processExit(uint192 _exitId) external {
        if (ExitId.isStandardExit(_exitId)) {
            PaymentStandardExitable.processStandardExit(_exitId);
        } else {
            require(false, "TODO: implement process in flight exit");
        }
    }
}
