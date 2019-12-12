pragma solidity 0.5.11;

import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";

import "../../interfaces/ISpendingCondition.sol";
import "../../../utils/PosLib.sol";
import "../../../transactions/PaymentTransactionModel.sol";
import "../../../transactions/outputs/PaymentOutputModel.sol";
import "../../../transactions/eip712Libs/PaymentEip712Lib.sol";

contract PaymentOutputToPaymentTxCondition is ISpendingCondition {
    using PaymentEip712Lib for PaymentEip712Lib.Constants;
    using PaymentOutputModel for PaymentOutputModel.Output;
    using PosLib for PosLib.Position;

    uint256 internal supportInputTxType;
    uint256 internal supportSpendingTxType;
    PaymentEip712Lib.Constants internal eip712;

    /**
     * @dev This is designed to be re-useable for all versions of payment transaction, so that
     *      inputTxType and spendingTxType of the payment output is injected instead
     */
    constructor(address framework, uint256 inputTxType, uint256 spendingTxType) public {
        eip712 = PaymentEip712Lib.initConstants(framework);
        supportInputTxType = inputTxType;
        supportSpendingTxType = spendingTxType;
    }

    /**
     * @notice Verifies the spending condition
     * @param inputTxBytes Encoded input transaction, in bytes
     * @param utxoPos Position of the utxo
     * @param spendingTxBytes Spending transaction, in bytes
     * @param inputIndex Input index of the spending tx that points to the output
     * @param signature Signature of the output owner
     */
    function verify(
        bytes calldata inputTxBytes,
        uint256 utxoPos,
        bytes calldata spendingTxBytes,
        uint16 inputIndex,
        bytes calldata signature
    )
        external
        view
        returns (bool)
    {
        PaymentTransactionModel.Transaction memory inputTx = PaymentTransactionModel.decode(inputTxBytes);
        require(inputTx.txType == supportInputTxType, "Input tx is an unsupported payment tx type");

        PaymentTransactionModel.Transaction memory spendingTx = PaymentTransactionModel.decode(spendingTxBytes);
        require(spendingTx.txType == supportSpendingTxType, "The spending tx is an unsupported payment tx type");

        require(
            spendingTx.inputs[inputIndex] == bytes32(utxoPos),
            "Spending tx points to the incorrect output UTXO position"
        );

        PosLib.Position memory decodedUtxoPos = PosLib.decode(utxoPos);
        address owner = inputTx.outputs[decodedUtxoPos.outputIndex].owner();
        address signer = ECDSA.recover(eip712.hashTx(spendingTx), signature);
        require(signer != address(0), "Failed to recover the signer from the signature");
        require(owner == signer, "Tx in not signed correctly");

        return true;
    }
}
