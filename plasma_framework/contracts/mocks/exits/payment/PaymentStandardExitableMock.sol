pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../../src/exits/payment/PaymentStandardExitable.sol";
import "../../../src/framework/interfaces/IPlasmaFramework.sol";
import "../../../src/vaults/interfaces/IEthVault.sol";
import "../../../src/vaults/interfaces/IErc20Vault.sol";

contract PaymentStandardExitableMock is PaymentStandardExitable {
    IPlasmaFramework private framework;

    constructor(IPlasmaFramework _framework, IEthVault _ethVault, IErc20Vault _erc20Vault)
        public
        PaymentStandardExitable(_framework, _ethVault, _erc20Vault)
    {
        framework = _framework;
    }

    /** override to make this non abstract contract */
    function processExit(uint256 _exitId) external {}

    function processStandardExit(uint256 _exitId) external {
        PaymentStandardExitable._processStandardExit(_exitId);
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
