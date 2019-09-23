pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../../src/exits/utils/TxFinalization.sol";

contract TxFinalizationWrapper {
    function getVerifier(
        address framework,
        uint8 protocol,
        bytes memory txBytes,
        uint256 txPos,
        bytes memory inclusionProof,
        bytes memory confirmSig,
        address confirmSigAddress
    )
        public
        pure
        returns (TxFinalization.Verifier memory)
    {
        return TxFinalization.Verifier({
            framework: PlasmaFramework(framework),
            protocol: protocol,
            txBytes: txBytes,
            txPos: TxPosLib.TxPos(txPos),
            inclusionProof: inclusionProof,
            confirmSig: confirmSig,
            confirmSigAddress: confirmSigAddress
        });
    }

    function isStandardFinalized(TxFinalization.Verifier memory verifier) public view returns (bool) {
        return TxFinalization.isStandardFinalized(verifier);
    }

    function isProtocolFinalized(TxFinalization.Verifier memory verifier) public view returns (bool) {
        return TxFinalization.isProtocolFinalized(verifier);
    }
}
