pragma solidity ^0.5.0;

import "../../framework/PlasmaFramework.sol";
import "../../framework/Protocol.sol";
import "../../utils/TxPosLib.sol";

library TxFinalizationModel {
    /**
     * @param framework Plasma framework contract
     * @param protocol Either MVP or MoreVp. See 'Protocol.sol' for the representive value
     * @param txBytes Encoded transaction, in bytes, which checks the finalization
     * @param txPos (Optional) Tx position of the transaction
     * @param inclusionProof (Optional) Inclusion proof for the Merkle path of the transaction
     * @param confirmSig (Optional) Confirm signature of the transaction
     * @param confirmSigAddress (Optional) Confirm signature address to check with
     */
    struct Data {
        PlasmaFramework framework;
        uint8 protocol;
        bytes txBytes;
        TxPosLib.TxPos txPos;
        bytes inclusionProof;
        bytes confirmSig;
        address confirmSigAddress;
    }

    function moreVpData(
        PlasmaFramework framework,
        bytes memory txBytes,
        TxPosLib.TxPos memory txPos,
        bytes memory inclusionProof
    )
        internal
        pure
        returns (Data memory)
    {
        // MoreVP protocol does not require check on confirm signature, thus putting empty value for related field.
        return Data({
            framework: framework,
            protocol: Protocol.MORE_VP(),
            txBytes: txBytes,
            txPos: txPos,
            inclusionProof: inclusionProof,
            confirmSig: bytes(""),
            confirmSigAddress: address(0)
        });
    }
}
