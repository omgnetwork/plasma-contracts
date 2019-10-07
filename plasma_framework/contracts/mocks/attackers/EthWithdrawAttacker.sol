pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/vaults/EthVault.sol";

contract EthWithdrawAttacker {

    bool private funded = false;
    EthVault private vault;
    uint256 private amount;

    constructor(EthVault _vault, uint256 _amount) public {
        vault = _vault;
        amount = _amount;
    }

    /* solhint-disable no-complex-fallback */
    function () external payable {
        if (funded) {
            vault.withdraw(address(this), amount);
        }
        funded = true;
    }

    function proxyEthWithdraw() external {
        vault.withdraw(address(this), amount);
    }
}
