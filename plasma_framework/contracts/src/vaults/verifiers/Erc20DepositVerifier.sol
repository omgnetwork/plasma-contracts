pragma solidity 0.5.11;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

import "./IErc20DepositVerifier.sol";
import {PaymentTransactionModel as DepositTx} from "../../transactions/PaymentTransactionModel.sol";
import {PaymentOutputModel as DepositOutputModel} from "../../transactions/outputs/PaymentOutputModel.sol";

contract Erc20DepositVerifier is IErc20DepositVerifier {
    using DepositOutputModel for DepositOutputModel.Output;

    uint8 constant internal DEPOSIT_TX_TYPE = 1;

    function verify(bytes calldata _depositTx, address _sender, address _vault)
        external
        view
        returns (
            address owner,
            address token,
            uint256 amount
        )
    {
        DepositTx.Transaction memory decodedTx = DepositTx.decode(_depositTx);

        require(decodedTx.txType == DEPOSIT_TX_TYPE, "Invalid transaction type");

        require(decodedTx.inputs.length == 0, "Deposit must have no inputs");

        require(decodedTx.outputs.length == 1, "Deposit must have exactly one output");
        require(decodedTx.outputs[0].token != address(0), "Invalid output currency (ETH)");

        address depositorsAddress = decodedTx.outputs[0].owner();
        require(depositorsAddress == _sender, "Depositor's address does not match sender's address");

        IERC20 erc20 = IERC20(decodedTx.outputs[0].token);
        require(erc20.allowance(depositorsAddress, _vault) == decodedTx.outputs[0].amount, "Tokens have not been approved");

        return (depositorsAddress, decodedTx.outputs[0].token, decodedTx.outputs[0].amount);
    }
}
