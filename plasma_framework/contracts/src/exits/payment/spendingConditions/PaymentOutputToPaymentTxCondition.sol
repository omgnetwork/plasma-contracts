pragma solidity 0.5.11;

import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";

import "../../interfaces/ISpendingCondition.sol";
import "../../../utils/UtxoPosLib.sol";
import "../../../utils/TxPosLib.sol";
import "../../../transactions/PaymentTransactionModel.sol";
import "../../../transactions/outputs/PaymentOutputModel.sol";
import "../../../transactions/eip712Libs/PaymentEip712Lib.sol";

contract PaymentOutputToPaymentTxCondition is ISpendingCondition {
    using PaymentEip712Lib for PaymentEip712Lib.Constants;
    using PaymentOutputModel for PaymentOutputModel.Output;
    using TxPosLib for TxPosLib.TxPos;

    uint256 internal supportInputTxType;
    uint256 internal supportSpendingTxType;
    PaymentEip712Lib.Constants internal eip712;

    constructor(address framework, uint256 inputTxType, uint256 spendingTxType) public {
        eip712 = PaymentEip712Lib.initConstants(framework);
        supportInputTxType = inputTxType;
        supportSpendingTxType = spendingTxType;
    }

    /**
     * @notice Verifies the spending condition
     * @param inputTxBytes encoded input transaction in bytes
     * @param outputIndex the output index of the input transaction
     * @param inputTxPos the tx position of the input tx. (0 if in-flight)
     * @param spendingTxBytes spending transaction in bytes
     * @param inputIndex the input index of the spending tx that points to the output
     * @param signature signature of the output owner
     */
    function verify(
        bytes calldata inputTxBytes,
        uint16 outputIndex,
        uint256 inputTxPos,
        bytes calldata spendingTxBytes,
        uint16 inputIndex,
        bytes calldata signature,
        bytes calldata /*optionalArgs*/
    )
        external
        view
        returns (bool)
    {
        PaymentTransactionModel.Transaction memory inputTx = PaymentTransactionModel.decode(inputTxBytes);
        require(inputTx.txType == supportInputTxType, "The input tx is not of the supported payment tx type");

        PaymentTransactionModel.Transaction memory spendingTx = PaymentTransactionModel.decode(spendingTxBytes);
        require(spendingTx.txType == supportSpendingTxType, "The spending tx is not of the supported payment tx type");

        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.build(TxPosLib.TxPos(inputTxPos), outputIndex);
        require(
            spendingTx.inputs[inputIndex] == bytes32(utxoPos.value),
            "The spending tx does not point to the correct utxo position of the output"
        );

        address payable owner = inputTx.outputs[outputIndex].owner();
        require(owner == ECDSA.recover(eip712.hashTx(spendingTx), signature), "Tx not correctly signed");

        return true;
    }
}
