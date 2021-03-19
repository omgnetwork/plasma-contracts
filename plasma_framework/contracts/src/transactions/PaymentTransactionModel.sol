pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "./FungibleTokenOutputModel.sol";
import "../utils/RLPReader.sol";

/**
 * @notice Data structure and its decode function for Payment transaction
 */
library PaymentTransactionModel {
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;

    uint8 constant private _MAX_INPUT_NUM = 5;
    uint8 constant private _MAX_OUTPUT_NUM = 5;

    uint8 constant private ENCODED_LENGTH = 4;

    // solhint-disable-next-line func-name-mixedcase
    function MAX_INPUT_NUM() internal pure returns (uint8) {
        return _MAX_INPUT_NUM;
    }

    // solhint-disable-next-line func-name-mixedcase
    function MAX_OUTPUT_NUM() internal pure returns (uint8) {
        return _MAX_OUTPUT_NUM;
    }

    struct Transaction {
        uint256 txType;
        bytes32[] inputs;
        FungibleTokenOutputModel.Output[] outputs;
        uint256 txData;
        bytes32 metaData;
    }

    /**
     * @notice Decodes a encoded byte array into a PaymentTransaction
     * The following rules about the rlp-encoded transaction are enforced:
     *      - `txType` must be an integer value with no leading zeros
     *      - `inputs` is an list of 0 to _MAX_INPUT_NUM elements
     *      - Each `input` is a 32 byte long array
     *      - An `input` may not be all zeros
     *      - `outputs` is an list of 0 to _MAX_OUTPUT_NUM elements
     *      - Each `output` is a list of 2 elements: [`outputType`, `data`]
     *      - `output.outputType` must be an integer value with no leading zeros
     *      - See FungibleTokenOutputModel for details on `output.data` encoding.
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
        require(genericTx.inputs.length <= _MAX_INPUT_NUM, "Transaction inputs num exceeds limit");
        require(genericTx.outputs.length != 0, "Transaction cannot have 0 outputs");
        require(genericTx.outputs.length <= _MAX_OUTPUT_NUM, "Transaction outputs num exceeds limit");

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

        // txData is unused, it must be 0
        require(genericTx.txData.toUint() == 0, "txData must be 0");

        return Transaction({
            txType: genericTx.txType,
            inputs: inputs,
            outputs: outputs,
            txData: 0,
            metaData: genericTx.metaData
        });
    }

    /**
     * @notice Retrieve the 'owner' from the output, assuming the
     *         'outputGuard' field directly holds the owner's address
     */
    function getOutputOwner(FungibleTokenOutputModel.Output memory output) internal pure returns (address payable) {
        return address(uint160(output.outputGuard));
    }

    /**
     * @notice Gets output at provided index
     *
     */
    function getOutput(Transaction memory transaction, uint16 outputIndex) internal pure returns (FungibleTokenOutputModel.Output memory) {
        require(outputIndex < transaction.outputs.length, "Output index out of bounds");
        return transaction.outputs[outputIndex];
    }
}
