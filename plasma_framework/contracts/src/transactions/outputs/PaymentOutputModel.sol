pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../utils/RLP.sol";
import "../../utils/AddressPayable.sol";

/**
 * @notice Data structure and its decode function for payment output
 */
library PaymentOutputModel {

    using RLP for RLP.RLPItem;

    struct Output {
        uint256 outputType;
        bytes20 outputGuard;
        address token;
        uint256 amount;
    }

    /**
     * @notice Retrieve the 'owner' from the output, assuming the 
     *         'outputGuard' field directly holds the owner's address
     * @dev It's possible that 'outputGuard' can be a hash of preimage that holds the owner information,
     *       but this should not and cannot be handled here.
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
