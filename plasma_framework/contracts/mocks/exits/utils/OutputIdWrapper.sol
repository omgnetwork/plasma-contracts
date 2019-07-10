pragma solidity ^0.5.0;

import "../../../src/exits/utils/OutputId.sol";

contract OutputIdWrapper {
    function compute(
        bool _isDeposit,
        bytes memory _txBytes,
        uint8 _outputIndex,
        uint256 _utxoPosValue
    )
        public
        pure
        returns (bytes32)
    {
        return OutputId.compute(_isDeposit, _txBytes, _outputIndex, _utxoPosValue);
    }
}
