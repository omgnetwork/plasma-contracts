pragma solidity ^0.5.0;

import "../../../src/vaults/interfaces/IErc20Vault.sol";

contract DummyErc20VaultForExitGame is IErc20Vault {
    event DummyErc20Withdraw(
        address target,
        address token,
        uint256 amount
    );

    function withdraw(address payable _target, address _token, uint256 _amount) external {
        emit DummyErc20Withdraw(_target, _token, _amount);
    }
}
