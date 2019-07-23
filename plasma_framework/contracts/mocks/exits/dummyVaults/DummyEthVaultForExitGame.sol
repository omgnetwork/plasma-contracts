pragma solidity ^0.5.0;

import "../../../src/vaults/interfaces/IEthVault.sol";

contract DummyEthVaultForExitGame is IEthVault {
    event DummyEthWithdraw(
        address target,
        uint256 amount
    );

    function withdraw(address payable _target, uint256 _amount) external {
        emit DummyEthWithdraw(_target, _amount);
    }
}
