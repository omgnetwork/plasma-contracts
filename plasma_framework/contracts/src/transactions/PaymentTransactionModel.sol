pragma solidity 0.5.11;

import "./outputs/PaymentOutputModel.sol";
import "../utils/RLPReader.sol";

/**
 * @notice Data structure and its decode function for Payment transaction
 */
library PaymentTransactionModel {

    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;
    using PaymentOutputModel for PaymentOutputModel.Output;

    uint8 constant public MAX_INPUT_NUM = 4;
    uint8 constant public MAX_OUTPUT_NUM = 4;

    uint8 constant private ENCODED_LENGTH = 4;

    struct Transaction {
        uint256 txType;
        bytes32[] inputs;
        PaymentOutputModel.Output[] outputs;
        bytes32 metaData;
    }

    /*
     * @notice Decodes a encoded byte array into a PaymentTransaction
     * The following rules about the rlp-encoded transaction are enforced:
     *      - `txType` must be an integer value with no leading zeros
     *      - `inputs` is an list of 0 to 4 elements
     *      - Each `input` is a 32 byte long array
     *      - An `input` may not be all zeros
     *      - `outputs` is an list of 0 to 4 elements
     *      - `output.outputType` must be an integer value with no leading zeros
     *      - `output.outputGuard` is a 20 byte long array
     *      - `output.token` is a 20 byte long array
     *      - `output.amount` must be an integer value with no leading zeros
     *      - An `output` may not be null; A null output is one whose amount is zero
     * @param tx An RLP-encoded transaction
     * @return A decoded PaymentTransaction struct
     */
    function decode(bytes memory _tx) internal pure returns (PaymentTransactionModel.Transaction memory) {
        RLPReader.RLPItem[] memory rlpTx = _tx.toRlpItem().toList();
        require(rlpTx.length == ENCODED_LENGTH, "Invalid encoding of transaction");

        RLPReader.RLPItem[] memory rlpInputs = rlpTx[1].toList();
        require(rlpInputs.length <= MAX_INPUT_NUM, "Transaction inputs num exceeds limit");

        RLPReader.RLPItem[] memory rlpOutputs = rlpTx[2].toList();
        require(rlpOutputs.length <= MAX_OUTPUT_NUM, "Transaction outputs num exceeds limit");

        uint txType = rlpTx[0].toUint();
        require(txType > 0, "Transaction type must not be 0");

        bytes32[] memory inputs = new bytes32[](rlpInputs.length);
        for (uint i = 0; i < rlpInputs.length; i++) {
            bytes32 input = rlpInputs[i].toBytes32();
            // Disallow null inputs
            require(uint256(input) != 0, "Null input not allowed");
            inputs[i] = input;
        }

        PaymentOutputModel.Output[] memory outputs = new PaymentOutputModel.Output[](rlpOutputs.length);
        for (uint i = 0; i < rlpOutputs.length; i++) {
            PaymentOutputModel.Output memory output = PaymentOutputModel.decode(rlpOutputs[i]);
            require(output.outputType > 0, "Output type must not be 0");
            outputs[i] = output;
        }

        bytes32 metaData = rlpTx[3].toBytes32();

        return Transaction({txType: txType, inputs: inputs, outputs: outputs, metaData: metaData});
    }
}
