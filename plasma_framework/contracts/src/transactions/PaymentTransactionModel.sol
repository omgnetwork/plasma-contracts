pragma solidity ^0.5.0;

import "./outputs/PaymentOutputModel.sol";
import "../utils/RLP.sol";

library PaymentTransactionModel {

    using RLP for bytes;
    using RLP for RLP.RLPItem;
    using PaymentOutputModel for PaymentOutputModel.Output;

    uint8 constant public MAX_INPUT_NUM = 4;
    uint8 constant public MAX_OUTPUT_NUM = 4;

    uint8 constant private ENCODED_LENGTH_WITH_METADATA = 4;
    uint8 constant private ENCODED_LENGTH_WITHOUT_METADATA = 3;

    struct Transaction {
        uint256 txType;
        bytes32[] inputs;
        PaymentOutputModel.Output[] outputs;
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
        require(rlpInputs.length < MAX_INPUT_NUM, "Transaction inputs num exceeds limit");

        RLP.RLPItem[] memory rlpOutputs = rlpTx[2].toList();
        require(rlpOutputs.length > 0, "Transaction must have outputs");
        require(rlpOutputs.length < MAX_OUTPUT_NUM, "Transaction outputs num exceeds limit");

        uint txType = rlpTx[0].toUint();

        bytes32[] memory inputs = new bytes32[](rlpInputs.length);
        for (uint i = 0; i < rlpInputs.length; i++) {
            bytes32 input = rlpInputs[i].toBytes32();
            inputs[i] = input;
        }

        PaymentOutputModel.Output[] memory outputs = new PaymentOutputModel.Output[](rlpOutputs.length);
        for (uint i = 0; i < rlpOutputs.length; i++) {
            PaymentOutputModel.Output memory output = PaymentOutputModel.decode(rlpOutputs[i]);
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
