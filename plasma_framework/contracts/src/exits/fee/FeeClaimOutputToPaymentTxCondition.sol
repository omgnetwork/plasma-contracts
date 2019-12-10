pragma solidity 0.5.11;

import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";

import "../interfaces/ISpendingCondition.sol";
import "../utils/OutputId.sol";
import "../../framework/PlasmaFramework.sol";
import "../../transactions/PaymentTransactionModel.sol";
import "../../transactions/GenericTransaction.sol";
import "../../transactions/eip712Libs/PaymentEip712Lib.sol";
import "../../utils/UtxoPosLib.sol";

contract FeeClaimOutputToPaymentTxCondition is ISpendingCondition {
    using PaymentEip712Lib for PaymentEip712Lib.Constants;
    using UtxoPosLib for UtxoPosLib.UtxoPos;

    uint256 public feeTxType;
    uint256 public feeClaimOutputType;
    uint256 public paymentTxType;
    PaymentEip712Lib.Constants internal eip712;

    constructor(
        PlasmaFramework _framework,
        uint256 _feeTxType,
        uint256 _feeClaimOutputType,
        uint256 _paymentTxType
    )
        public
    {
        eip712 = PaymentEip712Lib.initConstants(address(_framework));
        feeTxType = _feeTxType;
        feeClaimOutputType = _feeClaimOutputType;
        paymentTxType = _paymentTxType;
    }

    /**
     * @dev This implementation checks signature for spending fee claim output. It should be signed with the owner signature.
     *      The fee claim output that is spendable follows Fungible Token Output format.
     * @param feeTxBytes Encoded fee transaction
     * @param feeClaimOutputIndex Output index of the fee claim output
     * @param feeTxPos The tx position of the fee tx
     * @param paymentTxBytes Payment transaction (in bytes) that spends the fee claim output
     * @param inputIndex Input index of the payment tx that points to the fee claim output
     * @param signature Signature of the owner of fee claiming output
     */
    function verify(
        bytes calldata feeTxBytes,
        uint16 feeClaimOutputIndex,
        uint256 feeTxPos,
        bytes calldata paymentTxBytes,
        uint16 inputIndex,
        bytes calldata signature
    )
        external
        view
        returns (bool)
    {
        require(feeClaimOutputIndex == 0, "Fee claim output must be the first output of fee tx");

        GenericTransaction.Transaction memory feeTx = GenericTransaction.decode(feeTxBytes);
        GenericTransaction.Output memory feeClaimOutput = GenericTransaction.getOutput(feeTx, feeClaimOutputIndex);

        require(feeTx.txType == feeTxType, "Unexpected tx type for fee transaction");
        require(feeClaimOutput.outputType == feeClaimOutputType, "Unexpected output type for fee claim output");

        PaymentTransactionModel.Transaction memory paymentTx = PaymentTransactionModel.decode(paymentTxBytes);
        require(paymentTx.txType == paymentTxType, "Unexpected tx type for payment transaction");

        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.build(TxPosLib.TxPos(feeTxPos), feeClaimOutputIndex);
        require(
            paymentTx.inputs[inputIndex] == bytes32(utxoPos.value),
            "Payment tx points to the incorrect output UTXO position of the fee claim output"
        );

        address owner = address(feeClaimOutput.outputGuard);
        address signer = ECDSA.recover(eip712.hashTx(paymentTx), signature);
        require(signer != address(0), "Failed to recover the signer from the signature");
        require(owner == signer, "Tx is not signed correctly");

        return true;
    }
}
