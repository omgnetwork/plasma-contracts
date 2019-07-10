pragma solidity ^0.5.0;

library OutputGuard {

    /**
     * @notice Build the output guard from pre-image components (output type and output guard data).
     * @param _outputType type of the output
     * @param _outputGuardData output guard data in bytes
     * @return right most 20 bytes of the hashed data of pre-image with padding 0s in front
     */
    function build(
        uint256 _outputType,
        bytes memory _outputGuardData
    )
        internal
        pure
        returns (bytes32)
    {
        bytes32 hashData = keccak256(abi.encodePacked(_outputType, _outputGuardData));
        return bytes32(uint256(uint160(uint256(hashData))));
    }
}
