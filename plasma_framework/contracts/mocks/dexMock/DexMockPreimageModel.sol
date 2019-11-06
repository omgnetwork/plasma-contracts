pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/utils/RLPReader.sol";

library DexMockPreimageModel {
    struct Preimage {
        address venue;
        address trader;
        uint256 nonce;
    }

    /**
     * For simplicity, uses abi encode/decode for the preimage for DEX mock in tests.
     */
    function decode(bytes memory preimage) internal pure returns (Preimage memory) {
        (address venue, address trader, uint256 nonce) = abi.decode(preimage, (address, address, uint256));
        return Preimage(venue, trader, nonce);
    }
}
