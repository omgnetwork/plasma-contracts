pragma solidity ^0.5.0;

import "./Vault.sol";
import {PaymentTransactionModel as DepositTx} from "../transactions/PaymentTransactionModel.sol";
import {IERC20 as IERC20} from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import {SafeERC20 as SafeERC20} from "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";

contract Erc20Vault is Vault {
    using SafeERC20 for IERC20;

    constructor(address _blockController) Vault(_blockController) public {}

    /**
     * @notice Deposits approved amount of ERC20 token. Approve must have been called first.
     * @param _depositTx RLP encoded transaction to act as the deposit.
     */
    function deposit(bytes calldata _depositTx) external {
        DepositTx.Transaction memory decodedTx = DepositTx.decode(_depositTx);

        _validateDepositFormat(decodedTx);

        IERC20 erc20 = IERC20(decodedTx.outputs[0].token);

        // Check if tokens have been approved
        require(erc20.allowance(msg.sender, address(this)) == decodedTx.outputs[0].amount, "Tokens have not been approved");

        erc20.safeTransferFrom(msg.sender, address(this), decodedTx.outputs[0].amount);

        super._submitDepositBlock(_depositTx);
    }

    function _validateDepositFormat(DepositTx.Transaction memory _deposit) internal view {
        super._validateDepositFormat(_deposit);

        require(_deposit.outputs[0].token != address(0), "Invalid output currency (0x0)");
    }

    /**
    * @notice Withdraw plasma chain ERC20 tokens to target
    * @param _target Place to transfer eth.
    * @param _token Address of ERC20 token contract.
    * @param _amount Amount to transfer.
    */
    function withdraw(address _target, address _token, uint256 _amount) external onlyFromExitGame {
        IERC20(_token).safeTransfer(_target, _amount);
    }
}
