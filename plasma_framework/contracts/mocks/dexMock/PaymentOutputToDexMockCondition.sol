pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";

import "./DexMockTransactionModel.sol";
import "./DexMockPreimageModel.sol";
import "../../src/framework/PlasmaFramework.sol";
import "../../src/transactions/PaymentTransactionModel.sol";
import "../../src/utils/IsDeposit.sol";
import "../../src/utils/UtxoPosLib.sol";
import "../../src/exits/interfaces/ISpendingCondition.sol";
import "../../src/exits/utils/OutputId.sol";

contract PaymentOutputToDexMockCondition is ISpendingCondition {
    using UtxoPosLib for UtxoPosLib.UtxoPos;
    using IsDeposit for IsDeposit.Predicate;

    uint256 public supportInputTxType;
    uint256 public supportSpendingTxType;
    IsDeposit.Predicate public isDeposit;

    /**
     * @dev This is designed to be re-useable for all versions of payment transaction, so that
     *      inputTxType and spendingTxType of the payment output is injected instead
     */
    constructor(PlasmaFramework framework, uint256 inputTxType, uint256 spendingTxType) public {
        supportInputTxType = inputTxType;
        supportSpendingTxType = spendingTxType;
        isDeposit = IsDeposit.Predicate(framework.CHILD_BLOCK_INTERVAL());
    }

    /**
     * @dev This implementation only checks venue's signaure, and make the `optionalArgs` field the preimage directly.
     *      Depends on the security model we want, but potentially more things are of interest to be checked in a real DEX tx.
     *      (eg. trader's order signed)
     * @param inputTxBytes Encoded input transaction, in bytes
     * @param outputIndex Output index of the input transaction
     * @param inputTxPos The tx position of the input tx (0 if in-flight)
     * @param spendingTxBytes Spending transaction, in bytes
     * @param inputIndex Input index of the spending tx that points to the output
     * @param signature Signature of the venue
     * @param outputGuardPreimage Preimage of the output guard
     */
    function verify(
        bytes calldata inputTxBytes,
        uint16 outputIndex,
        uint256 inputTxPos,
        bytes calldata spendingTxBytes,
        uint16 inputIndex,
        bytes calldata signature,
        bytes calldata outputGuardPreimage
    )
        external
        view
        returns (bool)
    {
        (, DexMockTransactionModel.Transaction memory spendingTx) = verifyTxType(inputTxBytes, spendingTxBytes);

        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.build(TxPosLib.TxPos(inputTxPos), outputIndex);
        bytes32 outputId = getOutputId(inputTxBytes, utxoPos);

        require(
            spendingTx.inputs[inputIndex] == outputId,
            "Spending tx points to the incorrect outputId"
        );

        DexMockPreimageModel.Preimage memory preimage = DexMockPreimageModel.decode(outputGuardPreimage);

        // check the sha3 of tx bytes instead of eip712 struct hash for simplicity during test
        require(preimage.venue == ECDSA.recover(keccak256(spendingTxBytes), signature), "Dex (mock) Tx is not signed correctly by venue");

        return true;
    }

    function verifyTxType(bytes memory inputTxBytes, bytes memory spendingTxBytes)
        private
        view
        returns (PaymentTransactionModel.Transaction memory, DexMockTransactionModel.Transaction memory)
    {
        PaymentTransactionModel.Transaction memory inputTx = PaymentTransactionModel.decode(inputTxBytes);
        require(inputTx.txType == supportInputTxType, "Input tx is an unsupported payment tx type");

        DexMockTransactionModel.Transaction memory spendingTx = DexMockTransactionModel.decode(spendingTxBytes);
        require(spendingTx.txType == supportSpendingTxType, "The spending tx is an unsupported dex (mock) tx type");

        return (inputTx, spendingTx);
    }

    function getOutputId(bytes memory inputTxBytes, UtxoPosLib.UtxoPos memory utxoPos)
        private
        view
        returns (bytes32)
    {
        if (isDeposit.test(utxoPos.blockNum())) {
            return OutputId.computeDepositOutputId(inputTxBytes, utxoPos.outputIndex(), utxoPos.value);
        } else {
            return OutputId.computeNormalOutputId(inputTxBytes, utxoPos.outputIndex());
        }
    }
}
