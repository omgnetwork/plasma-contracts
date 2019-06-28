pragma solidity ^0.5.0;

import "./Vault.sol";
import {PaymentTransactionModel as DepositTx} from "../transactions/PaymentTransactionModel.sol";

contract EthVault is Vault {
    constructor(address _blockController) Vault(_blockController) public {}

    /**
     * @notice Allows a user to submit a deposit.
     * @param _depositTx RLP encoded transaction to act as the deposit.
     */
    function deposit(bytes calldata _depositTx) external payable {
        DepositTx.Transaction memory decodedTx = DepositTx.decode(_depositTx);

        _validateDepositFormat(decodedTx);

        super._submitDepositBlock(_depositTx);
    }

    function _validateDepositFormat(DepositTx.Transaction memory _deposit) internal view {
        super._validateDepositFormat(_deposit);

        require(_deposit.outputs[0].amount == msg.value, "Deposited value does not match sent amount");
        require(_deposit.outputs[0].token == address(0), "Output does not have correct currency (ETH)");
    }

    /**
    * @notice Withdraw plasma chain eth via transferring ETH.
    * @param _target Place to transfer eth.
    * @param _amount Amount of eth to transfer.
    */
    function withdraw(address payable _target, uint256 _amount) external onlyFromExitGame {
        _target.transfer(_amount);
    }
}
