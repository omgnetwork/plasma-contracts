pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./PaymentStandardExitable.sol";
import "../utils/ExitId.sol";
import "../../framework/interfaces/IExitProcessor.sol";

contract PaymentExitGame is IExitProcessor, PaymentStandardExitable {
    constructor(IPlasmaFramework _framework, IEthVault _ethVault, IErc20Vault _erc20Vault)
        public
        PaymentStandardExitable(_framework, _ethVault, _erc20Vault)
        {}

    function processExit(uint256 _exitId) external {
        uint192 exitId = uint192(_exitId);

        if (ExitId.isStandardExit(exitId)) {
            PaymentStandardExitable._processStandardExit(exitId);
        } else {
            require(false, "TODO: implement process in flight exit");
        }
    }
}
