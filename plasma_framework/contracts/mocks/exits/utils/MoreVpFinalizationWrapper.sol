pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../../src/exits/utils/MoreVpFinalization.sol";

contract MoreVpFinalizationWrapper {
    function isStandardFinalized(
        PlasmaFramework framework,
        bytes memory txBytes,
        uint256 txPos,
        bytes memory inclusionProof
    )
        public
        view
        returns (bool)
    {
        return MoreVpFinalization.isStandardFinalized(
            framework,
            txBytes,
            PosLib.decode(txPos),
            inclusionProof
        );
    }

    function isProtocolFinalized(
        PlasmaFramework framework,
        bytes memory txBytes
    )
        public
        view
        returns (bool)
    {
        return MoreVpFinalization.isProtocolFinalized(
            framework,
            txBytes
        );
    }
}
