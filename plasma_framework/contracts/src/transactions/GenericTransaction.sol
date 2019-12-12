pragma solidity 0.5.11;

import "../utils/RLPReader.sol";

/**
 * @title GenericTransaction
 * @notice GenericTransaction is a generic transaction format that makes few assumptions about the
 * content of the transaction. A transaction must satisy the following requirements:
 * - It must be a list of 5 items: [txType, inputs, outputs, txData, metaData]
 * - `txType` must be a uint not equal to zero
 * - inputs must be a list of RLP items.
 * - outputs must be a list of `Output`s
 * - an `Output` is a list of 2 items: [outputType, data]
 * - `Output.outputType` must be a uint not equal to zero
 * - `Output.data` is an RLP item. It can be a list.
 * - no assumptions are made about `txData`. Note that `txData` can be a list.
 * - `metaData` must be 32 bytes long.
 */
library GenericTransaction {

    uint8 constant private TX_NUM_ITEMS = 5;

    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;

    struct Transaction {
        uint256 txType;
        RLPReader.RLPItem[] inputs;
        Output[] outputs;
        RLPReader.RLPItem txData;
        bytes32 metaData;
    }

    struct Output {
        uint256 outputType;
        RLPReader.RLPItem data;
    }

    /**
    * @dev Decodes an RLP encoded transaction into the generic format.
    */
    function decode(bytes memory transaction) internal pure returns (Transaction memory) {
        RLPReader.RLPItem[] memory rlpTx = transaction.toRlpItem().toList();
        require(rlpTx.length == TX_NUM_ITEMS, "Invalid encoding of transaction");
        uint256 txType = rlpTx[0].toUint();
        require(txType > 0, "Transaction type must not be 0");

        RLPReader.RLPItem[] memory outputList = rlpTx[2].toList();
        Output[] memory outputs = new Output[](outputList.length);
        for (uint i = 0; i < outputList.length; i++) {
            outputs[i] = decodeOutput(outputList[i]);
        }

        bytes32 metaData = rlpTx[4].toBytes32();

        return Transaction({
            txType: txType,
            inputs: rlpTx[1].toList(),
            outputs: outputs,
            txData: rlpTx[3],
            metaData: metaData
        });
    }

    /**
    * @dev Returns the output at a specific index in the transaction
    */
    function getOutput(Transaction memory transaction, uint16 outputIndex)
        internal
        pure
        returns (Output memory)
    {
        require(outputIndex < transaction.outputs.length, "Output index out of bounds");
        return transaction.outputs[outputIndex];
    }

    /**
    * @dev Decodes an RLPItem to an output
    */
    function decodeOutput(RLPReader.RLPItem memory encodedOutput)
        internal
        pure
        returns (Output memory)
    {
        RLPReader.RLPItem[] memory rlpList = encodedOutput.toList();
        require(rlpList.length == 2, "Output must have 2 items");

        Output memory output = Output({
            outputType: rlpList[0].toUint(),
            data: rlpList[1]
        });

        require(output.outputType != 0, "Output type must not be 0");
        return output;
    }
}
