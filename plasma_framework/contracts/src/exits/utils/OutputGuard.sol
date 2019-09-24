pragma solidity ^0.5.0;

/**
 * @notice Utils library that builds the output guard
 * @dev Output guard is the design to enable private deposits to a DEX.
 *      OutputGuard itself looks exactly like an ethereum address however it requires the disclosure
 *      of preimage to be able to differentiate the DEX deposit output with a normal Payment output.
 *      For details and discussion: https://github.com/omisego/research/issues/84
 */
library OutputGuard {

    /**
     * @notice Build the output guard from pre-image components (output type and output guard data).
     * @param _outputType type of the output
     * @param _outputGuardPreimage output guard preimage data in bytes
     * @return right most 20 bytes of the hashed data
     */
    function build(
        uint256 _outputType,
        bytes memory _outputGuardPreimage
    )
        internal
        pure
        returns (bytes20)
    {
        bytes32 hashData = keccak256(abi.encodePacked(_outputType, _outputGuardPreimage));
        return bytes20(uint160(uint256(hashData)));
    }
}
