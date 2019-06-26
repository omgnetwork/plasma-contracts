pragma solidity ^0.5.0;

import "./outputs/PaymentOutputModel.sol";
import "../utils/RLP.sol";

library PaymentTransactionModel {

    using RLP for bytes;
    using RLP for RLP.RLPItem;

    uint8 constant private ENCODED_LENGTH_WITH_METADATA = 4;
    uint8 constant private ENCODED_LENGTH_WITHOUT_METADATA = 3;

    struct Transaction {
        uint256 txType;
        bytes32[] inputs;
        PaymentOutputModel.TxOutput[] outputs;
        bytes32 metaData;
    }

    function decode(bytes memory _tx) internal pure returns (PaymentTransactionModel.Transaction memory) {
        RLP.RLPItem[] memory rlpTx = _tx.toRLPItem().toList();
        require(
            rlpTx.length == ENCODED_LENGTH_WITH_METADATA || rlpTx.length == ENCODED_LENGTH_WITHOUT_METADATA,
            "Invalid encoding of transaction"
        );

        RLP.RLPItem[] memory rlpInputs = rlpTx[1].toList();
        require(rlpInputs.length > 0, "Transaction must have inputs");

        RLP.RLPItem[] memory rlpOutputs = rlpTx[2].toList();
        require(rlpOutputs.length > 0, "Transaction must have outputs");

        uint txType = rlpTx[0].toUint();

        bytes32[] memory inputs = new bytes32[](rlpInputs.length);
        for (uint i = 0; i < rlpInputs.length; i++) {
            bytes32 input = rlpInputs[i].toBytes32();
            inputs[i] = input;
        }

        PaymentOutputModel.TxOutput[] memory outputs = new PaymentOutputModel.TxOutput[](rlpOutputs.length);
        for (uint i = 0; i < rlpOutputs.length; i++) {
            PaymentOutputModel.TxOutput memory output = PaymentOutputModel.decodeOutput(rlpOutputs[i]);
            outputs[i] = output;
        }

        bytes32 metaData;
        if (rlpTx.length == ENCODED_LENGTH_WITH_METADATA) {
            metaData = rlpTx[3].toBytes32();
        } else {
            metaData = bytes32(0);
        }

        return Transaction({txType: txType, inputs: inputs, outputs: outputs, metaData: metaData});
    }
}
