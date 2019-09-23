pragma solidity 0.5.11;

import "../../../src/exits/utils/OutputId.sol";

contract OutputIdWrapper {
    function computeDepositOutputId(
        bytes memory _txBytes,
        uint8 _outputIndex,
        uint256 _utxoPosValue
    )
        public
        pure
        returns (bytes32)
    {
        return OutputId.computeDepositOutputId(_txBytes, _outputIndex, _utxoPosValue);
    }

    function computeNormalOutputId(
        bytes memory _txBytes,
        uint8 _outputIndex
    )
        public
        pure
        returns (bytes32)
    {
        return OutputId.computeNormalOutputId(_txBytes, _outputIndex);
    }
}
