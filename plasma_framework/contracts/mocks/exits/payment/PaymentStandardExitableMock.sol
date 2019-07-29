pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../../src/exits/payment/PaymentStandardExitable.sol";
import "../../../src/framework/PlasmaFramework.sol";
import "../../../src/vaults/EthVault.sol";
import "../../../src/vaults/Erc20Vault.sol";

contract PaymentStandardExitableMock is PaymentStandardExitable {
    PlasmaFramework private framework;

    constructor(PlasmaFramework _framework, EthVault _ethVault, Erc20Vault _erc20Vault)
        public
        PaymentStandardExitable(_framework, _ethVault, _erc20Vault)
    {
        framework = _framework;
    }

    /** override and calls processStandardExit for test */
    function processExit(uint256 _exitId) external {
        PaymentStandardExitable.processStandardExit(_exitId);
    }

    /** helper functions for testing */

    function setExit(uint192 _exitId, PaymentExitDataModel.StandardExit memory _exitData) public {
        PaymentStandardExitable.exits[_exitId] = _exitData;
    }

    function proxyFlagOutputSpent(bytes32 _outputId) public {
        framework.flagOutputSpent(_outputId);
    }

    function depositFundForTest() public payable {}
}
