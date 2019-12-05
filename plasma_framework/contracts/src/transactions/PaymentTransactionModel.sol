pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "./GenericTransaction.sol";
import "../utils/AddressPayable.sol";
import "../utils/RLPReader.sol";

/**
 * @notice Data structure and its decode function for Payment transaction
 */
library PaymentTransactionModel {
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;

    uint8 constant public MAX_INPUT_NUM = 4;
    uint8 constant public MAX_OUTPUT_NUM = 4;

    struct Transaction {
        uint256 txType;
        bytes32[] inputs;
        GenericTransaction.Output[] outputs;
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
        GenericTransaction.Transaction memory btx = GenericTransaction.decode(_tx);
        return fromGeneric(btx);
    }

    function fromGeneric(GenericTransaction.Transaction memory btx) internal pure returns (PaymentTransactionModel.Transaction memory) {
        require(btx.inputs.length <= MAX_INPUT_NUM, "Transaction inputs num exceeds limit");
        require(btx.outputs.length <= MAX_OUTPUT_NUM, "Transaction outputs num exceeds limit");

        bytes32[] memory inputs = new bytes32[](btx.inputs.length);
        for (uint i = 0; i < btx.inputs.length; i++) {
            bytes32 input = btx.inputs[i].toBytes32();
            // Disallow null inputs
            require(uint256(input) != 0, "Null input not allowed");
            inputs[i] = input;
        }

        GenericTransaction.Output[] memory outputs = new GenericTransaction.Output[](btx.outputs.length);
        for (uint i = 0; i < btx.outputs.length; i++) {
            outputs[i] = decodeOutput(btx.outputs[i]);
        }

        bytes32 metaData = btx.txData.toBytes32();

        return Transaction({txType: btx.txType, inputs: inputs, outputs: outputs, metaData: metaData});
    }

    function decodeOutput(RLPReader.RLPItem memory output) internal pure returns (GenericTransaction.Output memory) {
        RLPReader.RLPItem[] memory outputRlpList = output.toList();
        require(outputRlpList.length == 4, "Output must have 4 items");
        GenericTransaction.Output memory decodedOutput = GenericTransaction.decodeOutput(outputRlpList);
        require(decodedOutput.amount != 0, "Output amount must not be 0");
        return decodedOutput;
    }

    /**
     * @notice Retrieve the 'owner' from the output, assuming the
     *         'outputGuard' field directly holds the owner's address
     * @dev It's possible that 'outputGuard' can be a hash of preimage that holds the owner information,
     *       but this should not and cannot be handled here.
     */
    function getOutputOwner(GenericTransaction.Output memory _output) internal pure returns (address payable) {
        return AddressPayable.convert(address(_output.outputGuard));
    }
}
