pragma solidity ^0.5.0;

import "./Vault.sol";
import "./verifiers/IEthDepositVerifier.sol";
import "../framework/PlasmaFramework.sol";

contract EthVault is Vault {
    event EthWithdrawn(
        address payable indexed target,
        uint256 amount
    );

    constructor(PlasmaFramework _framework) public Vault(_framework) {}

    /**
     * @notice Allows a user to submit a deposit.
     * @param _depositTx RLP encoded transaction to act as the deposit.
     */
    function deposit(bytes calldata _depositTx) external payable {
        IEthDepositVerifier(getEffectiveDepositVerifier()).verify(_depositTx, msg.value, msg.sender);

        super._submitDepositBlock(_depositTx);
    }

    /**
    * @notice Withdraw plasma chain eth via transferring ETH.
    * @param _target Place to transfer eth.
    * @param _amount Amount of eth to transfer.
    */
    function withdraw(address payable _target, uint256 _amount) external onlyFromNonQuarantinedExitGame {
        _target.transfer(_amount);
        emit EthWithdrawn(_target, _amount);
    }
}
