pragma solidity ^0.5.0;

import "../../../src/utils/UtxoPosLib.sol";
import "./ExitIdLib.sol";

contract ExitId {
    function isStandardExit(uint192 _exitId) public pure returns (bool) {
        return ExitIdLib.isStandardExit(_exitId);
    }

    function getStandardExitId(bool _isDeposit, bytes memory _txBytes, uint256 _utxoPos)
        public
        pure
        returns (uint192)
    {
        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(_utxoPos);
        return ExitIdLib.getStandardExitId(_isDeposit, _txBytes, utxoPos);
    }

    function getInFlightExitId(bytes memory _txBytes)
        public
        pure
        returns (uint192)
    {
        return ExitIdLib.getInFlightExitId(_txBytes);
    }
}
