pragma solidity 0.5.11;

import "../../../src/vaults/EthVault.sol";
import "../../../src/framework/PlasmaFramework.sol";

contract SpyEthVaultForExitGame is EthVault {
    event EthWithdrawCalled(
        address target,
        uint256 amount
    );

    constructor(PlasmaFramework _framework) public EthVault(_framework) {}

    /** override for test */
    function withdraw(address payable _target, uint256 _amount) external {
        emit EthWithdrawCalled(_target, _amount);
    }
}
