pragma solidity ^0.5.0;

import "./IEthDepositVerifier.sol";
import {PaymentTransactionModel as DepositTx} from "../../transactions/PaymentTransactionModel.sol";
import {PaymentOutputModel as DepositOutputModel} from "../../transactions/outputs/PaymentOutputModel.sol";

contract EthDepositVerifier is IEthDepositVerifier {
    using DepositOutputModel for DepositOutputModel.Output;

    uint8 constant DEPOSIT_TX_TYPE = 1;

    function verify(bytes calldata _depositTx, uint256 amount, address _sender) external view {
        DepositTx.Transaction memory decodedTx = DepositTx.decode(_depositTx);

        require(decodedTx.txType == DEPOSIT_TX_TYPE, "Invalid transaction type");

        require(decodedTx.inputs.length == 1, "Deposit should have exactly one input");
        require(decodedTx.inputs[0] == bytes32(0), "Deposit input must be bytes32 of 0");

        require(decodedTx.outputs.length == 1, "Must have only one output");
        require(decodedTx.outputs[0].amount == amount, "Deposited value does not match sent amount");
        require(decodedTx.outputs[0].token == address(0), "Output does not have correct currency (ETH)");

        address depositorsAddress = decodedTx.outputs[0].owner();
        require(depositorsAddress == _sender, "Depositor's address does not match sender's address");

    }
}
