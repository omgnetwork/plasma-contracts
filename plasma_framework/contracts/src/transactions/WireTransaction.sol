pragma solidity 0.5.11;

import "../utils/RLPReader.sol";

/**
 * @title WireTransaction
 * @notice WireTransaction is a generic transaction format that makes few assumptions about the
 * content of the transaction. At minimum a transaction must:
 * - Be a list of 4 items: [txType, inputs, outputs, txData]
 * - `txType` must be a uint not equal to zero
 * - inputs must be a list
 * - outputs must be a list
 * - no assumptions are made about `txData`. Note that `txData` can be a list.
 *
 * It is expected that most transaction types will have similar outputs, so convenience methods for
 * decoding outputs are provided. However, transactions types are free to extend this output format
 * with extra data.
 */
library WireTransaction {

    uint8 constant private TX_NUM_ITEMS = 4;

    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;

    struct Transaction {
        uint256 txType;
        RLPReader.RLPItem[] inputs;
        RLPReader.RLPItem[] outputs;
        RLPReader.RLPItem txData;
    }

    struct Output {
        uint256 outputType;
        bytes20 outputGuard;
        address token;
        uint256 amount;
    }

    /**
    * @dev Decodes an RLP encoded transaction into the generic format.
    */
    function decode(bytes memory transaction) internal pure returns (Transaction memory) {
        RLPReader.RLPItem[] memory rlpTx = transaction.toRlpItem().toList();
        require(rlpTx.length == TX_NUM_ITEMS, "Invalid encoding of transaction");
        uint txType = rlpTx[0].toUint();
        require(txType > 0, "Transaction type must not be 0");

        return Transaction({
            txType: txType,
            inputs: rlpTx[1].toList(),
            outputs: rlpTx[2].toList(),
            txData: rlpTx[3]
        });
    }

    /**
    * @dev Returns the output at a specific index in the wire format transaction
    */
    function getOutput(Transaction memory transaction, uint16 outputIndex) internal pure returns (Output memory) {
        require(outputIndex < transaction.outputs.length, "Output index out of bounds");
        return decodeOutput(transaction.outputs[outputIndex].toList());
    }

    /**
    * @dev Decodes an RLPItem to an output
    * Each Output is a list with (at least) the following first four elements: outputType, outputGuard, token, amount
    */
    function decodeOutput(RLPReader.RLPItem[] memory outputRlpList) internal pure returns (Output memory) {
        require(outputRlpList.length >= 4, "Output must have at least 4 items");

        Output memory output = Output({
            outputType: outputRlpList[0].toUint(),
            outputGuard: bytes20(outputRlpList[1].toAddress()),
            token: outputRlpList[2].toAddress(),
            amount: outputRlpList[3].toUint()
        });

        require(output.outputType > 0, "Output type must not be 0");

        return output;
    }
}
