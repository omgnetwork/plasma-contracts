pragma solidity ^0.5.0;

import "./outputs/OutputModel.sol";
import "../utils/RLP.sol";

library TransactionModel {

    using OutputModel for OutputModel.TxOutput;
    using OutputModel for RLP.RLPItem;
    using RLP for bytes;
    using RLP for RLP.RLPItem;

    struct MetaData {
        bytes32 data;
    }

    struct Transaction {
        uint256 txType;
        bytes32[] inputs;
        OutputModel.TxOutput[] outputs;
        MetaData metaData;
    }

    function decode(bytes memory _tx) internal view returns (TransactionModel.Transaction memory) {
      RLP.RLPItem[] memory rlpTx = _tx.toRLPItem().toList();
      require(rlpTx.length == 4 || rlpTx.length == 3, "Invalid encoding of transaction");

      TransactionModel.Transaction memory decodedTx;
      decodedTx.txType = rlpTx[0].toUint();

      RLP.RLPItem[] memory rlpInputs = rlpTx[1].toList();
      require(rlpInputs.length > 0, "Transaction must have inputs");
      decodedTx.inputs = new bytes32[](rlpInputs.length);
      for (uint i = 0; i < rlpInputs.length; i++) {
        bytes32 input = rlpInputs[0].toBytes32();
        decodedTx.inputs[i] = input;
      }

      RLP.RLPItem[] memory rlpOutputs = rlpTx[2].toList();
      require(rlpOutputs.length > 1, "Transaction must have outputs");
      decodedTx.outputs = new OutputModel.TxOutput[](rlpOutputs.length);
      for (uint i = 0; i < rlpOutputs.length; i++) {
        OutputModel.TxOutput memory output = rlpOutputs[0].decodeOutput();
        decodedTx.outputs[i] = output;
      }

      if (rlpTx.length == 4) {
          decodedTx.metaData = MetaData(rlpTx[3].toBytes32());
      } else {
          decodedTx.metaData = MetaData("");
      }

      return decodedTx;
    }
}
