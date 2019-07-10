pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../eip712Libs/PaymentEip712Lib.sol";
import "../../utils/RLP.sol";
import "../../utils/AddressPayable.sol";

library PaymentOutputModel {

    using RLP for RLP.RLPItem;

    struct Output {
        uint256 amount;
        bytes32 outputGuard;
        address token;
    }

    /**
     * @notice Get the 'owner' from the output with the assumption of
     *         'outputGuard' field directly holding owner's address.
     * @dev 'outputGuard' can potentially be hash of pre-image that holds the owner info.
     *       This should not and cannot be handled here.
     */
    function owner(Output memory _output) internal pure returns (address payable) {
        return AddressPayable.convert(address(uint256(_output.outputGuard)));
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
