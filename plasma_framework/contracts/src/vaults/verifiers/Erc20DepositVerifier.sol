pragma solidity 0.5.11;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

import "./IErc20DepositVerifier.sol";
import {PaymentTransactionModel as DepositTx} from "../../transactions/PaymentTransactionModel.sol";
import {PaymentOutputModel as DepositOutputModel} from "../../transactions/outputs/PaymentOutputModel.sol";

/**
 * @notice Implementation of Erc20 deposit verifier using payment transaction as the deposit tx
 */
contract Erc20DepositVerifier is IErc20DepositVerifier {
    using DepositOutputModel for DepositOutputModel.Output;

    // Hardcoded transaction type for payment transaction
    uint8 constant private DEPOSIT_TX_TYPE = 1;

    /**
     * @notice Overrides the function of IErc20DepositVerifier and implements the verification logic
     *         for payment transaction
     * @dev Vault address must be approved to transfer from the sender address before doing the deposit
     * @return Verified (owner, token, amount) of the deposit ERC20 token data
     */
    function verify(bytes calldata depositTx, address sender, address vault)
        external
        view
        returns (
            address owner,
            address token,
            uint256 amount
        )
    {
        DepositTx.Transaction memory decodedTx = DepositTx.decode(depositTx);

        require(decodedTx.txType == DEPOSIT_TX_TYPE, "Invalid transaction type");

        require(decodedTx.inputs.length == 0, "Deposit must have no inputs");

        require(decodedTx.outputs.length == 1, "Deposit must have exactly one output");
        require(decodedTx.outputs[0].token != address(0), "Invalid output currency (ETH)");

        address depositorsAddress = decodedTx.outputs[0].owner();
        require(depositorsAddress == sender, "Depositor's address must match sender's address");

        IERC20 erc20 = IERC20(decodedTx.outputs[0].token);
        require(erc20.allowance(depositorsAddress, vault) == decodedTx.outputs[0].amount, "Tokens have not been approved");

        return (depositorsAddress, decodedTx.outputs[0].token, decodedTx.outputs[0].amount);
    }
}
