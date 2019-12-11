pragma solidity 0.5.11;

import "../../../src/utils/PosLib.sol";
import "../../../src/exits/utils/ExitId.sol";

contract ExitIdWrapper {
    function isStandardExit(uint160 _exitId) public pure returns (bool) {
        return ExitId.isStandardExit(_exitId);
    }

    function getStandardExitId(bool _isDeposit, bytes memory _txBytes, uint256 _utxoPos)
        public
        pure
        returns (uint160)
    {
        PosLib.Position memory utxoPos = PosLib.decode(_utxoPos);
        return ExitId.getStandardExitId(_isDeposit, _txBytes, utxoPos);
    }

    function getInFlightExitId(bytes memory _txBytes)
        public
        pure
        returns (uint160)
    {
        return ExitId.getInFlightExitId(_txBytes);
    }
}
