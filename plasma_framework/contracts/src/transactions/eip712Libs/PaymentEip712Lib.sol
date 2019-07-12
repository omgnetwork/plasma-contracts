pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../PaymentTransactionModel.sol";
import "../outputs/PaymentOutputModel.sol";
import "../../utils/UtxoPosLib.sol";

library PaymentEip712Lib {
    using UtxoPosLib for UtxoPosLib.UtxoPos;

    uint8 constant public MAX_INPUT_NUM = 4;
    uint8 constant public MAX_OUTPUT_NUM = 4;

    struct Constants {
        bytes2 EIP191_PREFIX;
        bytes32 EIP712_DOMAIN_HASH;
        bytes32 TX_TYPE_HASH;
        bytes32 INPUT_TYPE_HASH;
        bytes32 OUTPUT_TYPE_HASH;
        bytes32 DOMAIN_SEPARATOR;
    }

    function initConstants(address _verifyingContract) internal pure returns (Constants memory) {
        bytes2 EIP191_PREFIX = "\x19\x01";
        bytes32 EIP712_DOMAIN_HASH = keccak256(abi.encodePacked(
            "EIP712Domain(string name,string version,address verifyingContract,bytes32 salt)"
        ));
        bytes32 TX_TYPE_HASH = keccak256(abi.encodePacked(
            "Transaction(uint256 txType,Input input0,Input input1,Input input2,Input input3,Output output0,Output output1,Output output2,Output output3,bytes32 metadata)Input(uint256 blknum,uint256 txindex,uint256 oindex)Output(bytes32 owner,address currency,uint256 amount)"
        ));
        bytes32 INPUT_TYPE_HASH = keccak256(abi.encodePacked("Input(uint256 blknum,uint256 txindex,uint256 oindex)"));
        bytes32 OUTPUT_TYPE_HASH = keccak256(abi.encodePacked("Output(bytes32 owner,address currency,uint256 amount)"));

        bytes32 salt = 0xfad5c7f626d80f9256ef01929f3beb96e058b8b4b0e3fe52d84f054c0e2a7a83;

        bytes32 DOMAIN_SEPARATOR = keccak256(abi.encode(
            EIP712_DOMAIN_HASH,
            keccak256("OMG Network"),
            keccak256("1"),
            address(_verifyingContract),
            salt
        ));

        return Constants({
            EIP191_PREFIX: EIP191_PREFIX,
            EIP712_DOMAIN_HASH: EIP712_DOMAIN_HASH,
            TX_TYPE_HASH: TX_TYPE_HASH,
            INPUT_TYPE_HASH: INPUT_TYPE_HASH,
            OUTPUT_TYPE_HASH: OUTPUT_TYPE_HASH,
            DOMAIN_SEPARATOR: DOMAIN_SEPARATOR
        });
    }

    function hashTx(Constants memory _eip712, PaymentTransactionModel.Transaction memory _tx)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(
            _eip712.EIP191_PREFIX,
            _eip712.DOMAIN_SEPARATOR,
            _hashTx(_eip712, _tx)
        ));
    }

    function _hashTx(Constants memory _eip712, PaymentTransactionModel.Transaction memory _tx)
        private
        pure
        returns (bytes32)
    {
        // pad empty value to input array
        bytes32[] memory inputs = new bytes32[](MAX_INPUT_NUM);
        for (uint i = 0; i < _tx.inputs.length ; i++) {
            inputs[i] = _tx.inputs[i];
        }

        // pad empty value to output array
        PaymentOutputModel.Output[] memory outputs = new PaymentOutputModel.Output[](MAX_OUTPUT_NUM);
        for (uint i = 0; i < _tx.outputs.length ; i++) {
            outputs[i] = _tx.outputs[i];
        }

        return keccak256(abi.encode(
            _eip712.TX_TYPE_HASH,
            _tx.txType,
            _hashInput(_eip712, inputs[0]),
            _hashInput(_eip712, inputs[1]),
            _hashInput(_eip712, inputs[2]),
            _hashInput(_eip712, inputs[3]),
            _hashOutput(_eip712, outputs[0]),
            _hashOutput(_eip712, outputs[1]),
            _hashOutput(_eip712, outputs[2]),
            _hashOutput(_eip712, outputs[3]),
            _tx.metaData
        ));
    }

    function _hashInput(Constants memory _eip712, bytes32 _input) private pure returns (bytes32) {
        UtxoPosLib.UtxoPos memory utxo = UtxoPosLib.UtxoPos(uint256(_input));
        return keccak256(abi.encode(
            _eip712.INPUT_TYPE_HASH,
            utxo.blockNum(),
            utxo.txIndex(),
            uint256(utxo.outputIndex())
        ));
    }

    function _hashOutput(Constants memory _eip712, PaymentOutputModel.Output memory _output)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(
            _eip712.OUTPUT_TYPE_HASH,
            _output.outputGuard,
            _output.token,
            _output.amount
        ));
    }
}
