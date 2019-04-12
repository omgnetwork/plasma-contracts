pragma solidity ^0.4.0;

import "./PlasmaCore.sol";
import "./Eip712SignVerifier.sol";


/**
 * @title PlasmaCoreTest
 * @dev Tests PlasmaCore library
 */
contract PlasmaCoreTest {
    using PlasmaCore for bytes;

    function sliceProof(bytes memory _proofs, uint256 _index)
        public
        pure
        returns (bytes)
    {
        return PlasmaCore.sliceProof(_proofs, _index);
    }

    function sliceSignature(bytes memory _signatures, uint256 _index)
        public
        pure
        returns (bytes)
    {
        return PlasmaCore.sliceSignature(_signatures, _index);
    }

    function getOutput(bytes _tx, uint8 _outputIndex)
        public
        view
        returns (address, address, uint256)
    {
        PlasmaCore.TransactionOutput memory output = PlasmaCore.getOutput(_tx, _outputIndex);
        return (output.owner, output.token, output.amount);
    }

    function getInputUtxoPosition(bytes _tx, uint8 _inputIndex)
        public
        view
        returns (uint256)
    {
        return PlasmaCore.getInputUtxoPosition(_tx, _inputIndex);
    }

    function getOindex(uint256 _utxoPos)
        public
        pure
        returns (uint8)
    {
        return PlasmaCore.getOindex(_utxoPos);
    }

    function getTxPos(uint256 _utxoPos)
        public
        pure
        returns (uint256)
    {
        return PlasmaCore.getTxPos(_utxoPos);
    }

    function getTxIndex(uint256 _utxoPos)
        public
        pure
        returns (uint256)
    {
        return PlasmaCore.getTxIndex(_utxoPos);
    }

    function getBlknum(uint256 _utxoPos)
        public
        pure
        returns (uint256)
    {
        return PlasmaCore.getBlknum(_utxoPos);
    }
}
