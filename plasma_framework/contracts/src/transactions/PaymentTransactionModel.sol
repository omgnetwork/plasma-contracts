pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "./FungibleTokenOutputModel.sol";
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
        FungibleTokenOutputModel.Output[] outputs;
        bytes32 metaData;
    }

    /**
     * @notice Decodes a encoded byte array into a PaymentTransaction
     * The following rules about the rlp-encoded transaction are enforced:
     *      - `txType` must be an integer value with no leading zeros
     *      - `inputs` is an list of 0 to 4 elements
     *      - Each `input` is a 32 byte long array
     *      - An `input` may not be all zeros
     *      - `outputs` is an list of 0 to 4 elements
     *      - Each `output` is a list of 2 elements: [`outputType`, `data`]
     *      - `output.outputType` must be an integer value with no leading zeros
     *      - See FungibleTokenOutputModel for deatils on `output.data` encoding.
     *      - An `output` may not be null; A null output is one whose amount is zero
     * @param _tx An RLP-encoded transaction
     * @return A decoded PaymentTransaction struct
     */
    function decode(bytes memory _tx) internal pure returns (PaymentTransactionModel.Transaction memory) {
        return fromGeneric(GenericTransaction.decode(_tx));
    }

    /**
     * @notice Converts a GenericTransaction to a PaymentTransaction
     * @param genericTx A GenericTransaction.Transaction struct
     * @return A PaymentTransaction.Transaction struct
     */
    function fromGeneric(GenericTransaction.Transaction memory genericTx)
        internal
        pure
        returns (PaymentTransactionModel.Transaction memory)
    {
        require(genericTx.inputs.length <= MAX_INPUT_NUM, "Transaction inputs num exceeds limit");
        require(genericTx.outputs.length <= MAX_OUTPUT_NUM, "Transaction outputs num exceeds limit");

        bytes32[] memory inputs = new bytes32[](genericTx.inputs.length);
        for (uint i = 0; i < genericTx.inputs.length; i++) {
            bytes32 input = genericTx.inputs[i].toBytes32();
            require(uint256(input) != 0, "Null input not allowed");
            inputs[i] = input;
        }

        FungibleTokenOutputModel.Output[] memory outputs = new FungibleTokenOutputModel.Output[](genericTx.outputs.length);
        for (uint i = 0; i < genericTx.outputs.length; i++) {
            outputs[i] = FungibleTokenOutputModel.decodeOutput(genericTx.outputs[i]);
        }

        bytes32 metaData = genericTx.txData.toBytes32();

        return Transaction({txType: genericTx.txType, inputs: inputs, outputs: outputs, metaData: metaData});
    }

    /**
     * @notice Retrieve the 'owner' from the output, assuming the
     *         'outputGuard' field directly holds the owner's address
     */
    function getOutputOwner(FungibleTokenOutputModel.Output memory output) internal pure returns (address payable) {
        return AddressPayable.convert(address(output.outputGuard));
    }
}
