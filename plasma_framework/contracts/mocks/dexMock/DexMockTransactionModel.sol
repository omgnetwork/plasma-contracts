pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "./DexMockOutputModel.sol";
import "../../src/utils/RLPReader.sol";

/**
 * @notice Data structure and its decode function for Dex (mock) transaction for testing
 * @dev This data structure follows WireTransaction format. This mock implementation is mostly the same as
 *      the PaymentTransaction aside from removing the input and output size limit.
 */
library DexMockTransactionModel {

    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;
    using DexMockOutputModel for DexMockOutputModel.Output;

    uint8 constant private ENCODED_LENGTH = 4;

    struct Transaction {
        uint256 txType;
        bytes32[] inputs;
        DexMockOutputModel.Output[] outputs;
        bytes32 metaData;
    }

    function decode(bytes memory _tx) internal pure returns (Transaction memory) {
        RLPReader.RLPItem[] memory rlpTx = _tx.toRlpItem().toList();
        require(rlpTx.length == ENCODED_LENGTH, "Invalid encoding of transaction");

        RLPReader.RLPItem[] memory rlpInputs = rlpTx[1].toList();

        RLPReader.RLPItem[] memory rlpOutputs = rlpTx[2].toList();

        uint txType = rlpTx[0].toUint();

        bytes32[] memory inputs = new bytes32[](rlpInputs.length);
        for (uint i = 0; i < rlpInputs.length; i++) {
            bytes32 input = bytes32(rlpInputs[i].toUint());
            inputs[i] = input;
        }

        DexMockOutputModel.Output[] memory outputs = new DexMockOutputModel.Output[](rlpOutputs.length);
        for (uint i = 0; i < rlpOutputs.length; i++) {
            DexMockOutputModel.Output memory output = DexMockOutputModel.decode(rlpOutputs[i]);
            outputs[i] = output;
        }

        bytes32 metaData = bytes32(rlpTx[3].toUint());

        return Transaction({txType: txType, inputs: inputs, outputs: outputs, metaData: metaData});
    }
}
