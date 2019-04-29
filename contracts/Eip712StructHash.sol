pragma solidity ^0.4.0;

import "./ECRecovery.sol";
import "./PlasmaCore.sol";


/**
 * @title Eip712StructHash
 * @dev Utilities for hashing structural data, see EIP-712.
 */
library Eip712StructHash {
    using PlasmaCore for bytes;

    bytes2  constant EIP191_PREFIX       = "\x19\x01";
    bytes32 constant EIP712_DOMAIN_HASH  = keccak256(abi.encodePacked("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)"));
    bytes32 constant TX_TYPE_HASH        = keccak256(abi.encodePacked("Transaction(Input input0,Input input1,Input input2,Input input3,Output output0,Output output1,Output output2,Output output3,bytes32 metadata)Input(uint256 blknum,uint256 txindex,uint256 oindex)Output(address owner,address token,uint256 amount)"));
    bytes32 constant INPUT_TYPE_HASH     = keccak256(abi.encodePacked("Input(uint256 blknum,uint256 txindex,uint256 oindex)"));
    bytes32 constant OUTPUT_TYPE_HASH    = keccak256(abi.encodePacked("Output(address owner,address token,uint256 amount)"));


    uint256 constant chainId = 4;
    address constant verifyingContract = 0x44de0Ec539b8C4a4b530c78620Fe8320167F2F74;
    bytes32 constant salt = 0xfad5c7f626d80f9256ef01929f3beb96e058b8b4b0e3fe52d84f054c0e2a7a83;


    bytes32 constant DOMAIN_SEPARATOR = keccak256(abi.encode(
        EIP712_DOMAIN_HASH,
        keccak256("OMG Network"),
        keccak256("1"),
        chainId,
        verifyingContract,
        salt
    ));

    function hash(bytes _tx)
        internal
        view
        returns (bytes32)
    {
        return hash(_tx.decode());
    }

    function hash(PlasmaCore.Transaction memory _tx)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(
            EIP191_PREFIX,
            DOMAIN_SEPARATOR,
            keccak256(abi.encode(
                TX_TYPE_HASH,
                hash(_tx.inputs[0]),
                hash(_tx.inputs[1]),
                hash(_tx.inputs[2]),
                hash(_tx.inputs[3]),
                hash(_tx.outputs[0]),
                hash(_tx.outputs[1]),
                hash(_tx.outputs[2]),
                hash(_tx.outputs[3]),
                _tx.metadata
            ))
        ));
    }

    function hash(PlasmaCore.TransactionInput memory _input)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(
            INPUT_TYPE_HASH,
            _input.blknum,
            _input.txindex,
            _input.oindex
        ));
    }

    function hash(PlasmaCore.TransactionOutput memory _output)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(
            OUTPUT_TYPE_HASH,
            _output.owner,
            _output.token,
            _output.amount
        ));
    }
}