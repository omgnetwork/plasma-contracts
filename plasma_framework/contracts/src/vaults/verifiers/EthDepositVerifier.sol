pragma solidity 0.5.11;

import "./IEthDepositVerifier.sol";
import {PaymentTransactionModel as DepositTx} from "../../transactions/PaymentTransactionModel.sol";
import {PaymentOutputModel as DepositOutputModel} from "../../transactions/outputs/PaymentOutputModel.sol";

/**
 * @notice implementation of Eth deposit verifier using Payment transaction as the deposit tx
 */
contract EthDepositVerifier is IEthDepositVerifier {
    using DepositOutputModel for DepositOutputModel.Output;

    // hardcoded tx type for Payment Transaction
    uint8 constant internal DEPOSIT_TX_TYPE = 1;

    /**
     * @notice Overrides the function of IEthDepositVerifier and implements the verification logic
     *         for Payment transaction.
     */
    function verify(bytes calldata depositTx, uint256 amount, address sender) external view {
        DepositTx.Transaction memory decodedTx = DepositTx.decode(depositTx);

        require(decodedTx.txType == DEPOSIT_TX_TYPE, "Invalid transaction type");

        require(decodedTx.inputs.length == 0, "Deposit must have no inputs");

        require(decodedTx.outputs.length == 1, "Deposit must have exactly one output");
        require(decodedTx.outputs[0].amount == amount, "Deposited value does not match sent amount");
        require(decodedTx.outputs[0].token == address(0), "Output does not have correct currency (ETH)");

        address depositorsAddress = decodedTx.outputs[0].owner();
        require(depositorsAddress == sender, "Depositor's address does not match sender's address");
    }
}
