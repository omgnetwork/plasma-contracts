pragma solidity 0.5.11;

import "./IEthDepositVerifier.sol";
import {PaymentTransactionModel as DepositTx} from "../../transactions/PaymentTransactionModel.sol";
import {PaymentOutputModel as DepositOutputModel} from "../../transactions/outputs/PaymentOutputModel.sol";

/**
 * @notice Implementation of ETH deposit verifier using payment transaction as the deposit transaction
 */
contract EthDepositVerifier is IEthDepositVerifier {
    using DepositOutputModel for DepositOutputModel.Output;

    uint256 public depositTxType;
    uint256 public supportedOutputType;

    constructor(uint256 txType, uint256 outputType) public {
        depositTxType = txType;
        supportedOutputType = outputType;
    }

    /**
     * @notice Overrides the function of IEthDepositVerifier and implements the verification logic
     *         for payment transaction
     */
    function verify(bytes calldata depositTx, uint256 amount, address sender) external view {
        DepositTx.Transaction memory decodedTx = DepositTx.decode(depositTx);

        require(decodedTx.txType == depositTxType, "Invalid transaction type");

        require(decodedTx.inputs.length == 0, "Deposit must have no inputs");

        require(decodedTx.outputs.length == 1, "Deposit must have exactly one output");
        require(decodedTx.outputs[0].amount == amount, "Deposited value must match sent amount");
        require(decodedTx.outputs[0].token == address(0), "Output requires correct currency (ETH)");
        require(decodedTx.outputs[0].outputType == supportedOutputType, "Invalid output type");

        address depositorsAddress = decodedTx.outputs[0].owner();
        require(depositorsAddress == sender, "Depositor's address must match sender's address");
    }
}
