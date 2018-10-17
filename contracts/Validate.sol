pragma solidity ^0.4.0;

import "./ByteUtils.sol";
import "./ECRecovery.sol";


/**
 * @title Validate
 * @dev Checks that the signatures on a transaction are valid
 */
library Validate {
    function checkSigs(bytes32 txHash, address exitor, uint256 oindex, bytes sigs)
        internal
        view
        returns (bool)
    {
        require(sigs.length % 65 == 0 && sigs.length <= 130);

        if (oindex > 0) {
            bytes memory sig2 = ByteUtils.slice(sigs, 65, 65);
            return exitor == ECRecovery.recover(txHash, sig2);
        }
        else {
            bytes memory sig1 = ByteUtils.slice(sigs, 0, 65);
            return exitor == ECRecovery.recover(txHash, sig1);
        }
    }
}
