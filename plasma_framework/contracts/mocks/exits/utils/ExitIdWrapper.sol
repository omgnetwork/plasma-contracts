pragma solidity ^0.5.0;

import "../../../src/utils/UtxoPosLib.sol";
import "../../../src/exits/utils/ExitId.sol";

contract ExitIdWrapper {
    function getStandardExitId(bool _isDeposit, bytes memory _txBytes, uint256 _utxoPos)
        public
        pure
        returns (uint192)
    {
        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(_utxoPos);
        return ExitId.getStandardExitId(_isDeposit, _txBytes, utxoPos);
    }
}
