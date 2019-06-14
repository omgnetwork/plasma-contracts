pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../utils/RLP.sol";

library OutputModel {

    using RLP for bytes;
    using RLP for RLP.RLPItem;

    struct TxOutput {
      uint256 amount;
      bytes32 outputGuard;
      address token;
    }

    function hash(TxOutput memory _output) internal pure returns (bytes32) {
        return keccak256(abi.encode(_output));
    }

    function decodeOutput(bytes memory encoded) internal pure returns (TxOutput memory) {
        RLP.RLPItem memory rlpEncoded = encoded.toRLPItem();
        return decodeOutput(rlpEncoded);
    }

    function decodeOutput(RLP.RLPItem memory encoded) internal pure returns (TxOutput memory) {
      RLP.RLPItem[] memory rlpEncoded = encoded.toList();
      require(rlpEncoded.length == 3, "invalid output encoding");

      TxOutput memory output = TxOutput({
        amount: rlpEncoded[0].toUint(),
        outputGuard: rlpEncoded[1].toBytes32(),
        token: rlpEncoded[2].toAddress()
      });

      return output;
    }
}
