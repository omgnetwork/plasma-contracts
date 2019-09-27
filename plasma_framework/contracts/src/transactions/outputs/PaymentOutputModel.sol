pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../utils/RLP.sol";
import "../../utils/AddressPayable.sol";

library PaymentOutputModel {

    using RLP for RLP.RLPItem;

    struct Output {
        uint256 outputType;
        bytes20 outputGuard;
        address token;
        uint256 amount;
    }

    /**
     * @notice Get the 'owner' from the output with the assumption of
     *         'outputGuard' field directly holding owner's address.
     * @dev 'outputGuard' can potentially be hash of pre-image that holds the owner info.
     *       This should not and cannot be handled here.
     */
    function owner(Output memory _output) internal pure returns (address payable) {
        return AddressPayable.convert(address(uint160(_output.outputGuard)));
    }

    function decode(RLP.RLPItem memory encoded) internal pure returns (Output memory) {
        RLP.RLPItem[] memory rlpEncoded = encoded.toList();
        require(rlpEncoded.length == 4, "Invalid output encoding");

        Output memory output = Output({
            outputType: rlpEncoded[0].toUint(),
            outputGuard: rlpEncoded[1].toBytes20(),
            token: rlpEncoded[2].toAddress(),
            amount: rlpEncoded[3].toUint()
        });

        return output;
    }
}
