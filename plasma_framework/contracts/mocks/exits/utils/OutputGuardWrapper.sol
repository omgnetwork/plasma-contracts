pragma solidity ^0.5.0;

import "../../../src/exits/utils/OutputGuard.sol";

contract OutputGuardWrapper {
    function build(
        uint256 _outputType,
        bytes memory _outputGuardData
    )
        public
        pure
        returns (bytes32)
    {
        return OutputGuard.build(_outputType, _outputGuardData);
    }
}
