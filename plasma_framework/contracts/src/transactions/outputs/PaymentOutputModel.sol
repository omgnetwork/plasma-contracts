pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../utils/RLP.sol";

library PaymentOutputModel {

    using RLP for RLP.RLPItem;

    struct Output {
        uint256 amount;
        bytes32 outputGuard;
        address token;
    }

    function hash(Output memory _output) internal pure returns (bytes32) {
        return keccak256(abi.encode(_output));
    }

    function decode(RLP.RLPItem memory encoded) internal pure returns (Output memory) {
        RLP.RLPItem[] memory rlpEncoded = encoded.toList();
        require(rlpEncoded.length == 3, "Invalid output encoding");

        Output memory output = Output({
            amount: rlpEncoded[0].toUint(),
            outputGuard: rlpEncoded[1].toBytes32(),
            token: rlpEncoded[2].toAddress()
        });

        return output;
    }
}
