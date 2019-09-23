pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../PaymentTransactionModel.sol";
import "../outputs/PaymentOutputModel.sol";
import "../../utils/UtxoPosLib.sol";

library PaymentEip712Lib {
    using UtxoPosLib for UtxoPosLib.UtxoPos;

    uint8 constant public MAX_INPUT_NUM = 4;
    uint8 constant public MAX_OUTPUT_NUM = 4;

    bytes2 constant internal EIP191_PREFIX = "\x19\x01";

    bytes32 constant internal EIP712_DOMAIN_HASH = keccak256(
        "EIP712Domain(string name,string version,address verifyingContract,bytes32 salt)"
    );

    bytes32 constant internal TX_TYPE_HASH = keccak256(
        "Transaction(uint256 txType,Input input0,Input input1,Input input2,Input input3,Output output0,Output output1,Output output2,Output output3,bytes32 metadata)Input(uint256 blknum,uint256 txindex,uint256 oindex)Output(bytes32 owner,address currency,uint256 amount)"
    );

    bytes32 constant internal INPUT_TYPE_HASH = keccak256("Input(uint256 blknum,uint256 txindex,uint256 oindex)");
    bytes32 constant internal OUTPUT_TYPE_HASH = keccak256("Output(bytes32 owner,address currency,uint256 amount)");
    bytes32 constant internal SALT = 0xfad5c7f626d80f9256ef01929f3beb96e058b8b4b0e3fe52d84f054c0e2a7a83;

    bytes32 constant internal EMPTY_INPUT_HASH = keccak256(abi.encode(INPUT_TYPE_HASH, 0, 0, 0));
    bytes32 constant internal EMPTY_OUTPUT_HASH = keccak256(abi.encode(OUTPUT_TYPE_HASH, bytes32(""), bytes32(""), 0));

    struct Constants {
        // solhint-disable-next-line var-name-mixedcase
        bytes32 DOMAIN_SEPARATOR; 
    }

    function initConstants(address _verifyingContract) internal pure returns (Constants memory) {
        // solhint-disable-next-line var-name-mixedcase
        bytes32 DOMAIN_SEPARATOR = keccak256(abi.encode(
            EIP712_DOMAIN_HASH,
            keccak256("OMG Network"),
            keccak256("1"),
            address(_verifyingContract),
            SALT
        ));

        return Constants({
            DOMAIN_SEPARATOR: DOMAIN_SEPARATOR
        });
    }

    function hashTx(Constants memory _eip712, PaymentTransactionModel.Transaction memory _tx)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(
            EIP191_PREFIX,
            _eip712.DOMAIN_SEPARATOR,
            _hashTx(_tx)
        ));
    }

    function _hashTx(PaymentTransactionModel.Transaction memory _tx)
        private
        pure
        returns (bytes32)
    {
        // pad empty value to input array
        bytes32[] memory inputs = new bytes32[](MAX_INPUT_NUM);
        for (uint i = 0; i < _tx.inputs.length; i++) {
            inputs[i] = _tx.inputs[i];
        }

        // pad empty value to output array
        PaymentOutputModel.Output[] memory outputs = new PaymentOutputModel.Output[](MAX_OUTPUT_NUM);
        for (uint i = 0; i < _tx.outputs.length; i++) {
            outputs[i] = _tx.outputs[i];
        }

        return keccak256(abi.encode(
            TX_TYPE_HASH,
            _tx.txType,
            _hashInput(inputs[0]),
            _hashInput(inputs[1]),
            _hashInput(inputs[2]),
            _hashInput(inputs[3]),
            _hashOutput(outputs[0]),
            _hashOutput(outputs[1]),
            _hashOutput(outputs[2]),
            _hashOutput(outputs[3]),
            _tx.metaData
        ));
    }

    function _hashInput(bytes32 _input) private pure returns (bytes32) {
        uint256 inputUtxoValue = uint256(_input);
        if (inputUtxoValue == 0) {
            return EMPTY_INPUT_HASH;
        }

        UtxoPosLib.UtxoPos memory utxo = UtxoPosLib.UtxoPos(inputUtxoValue);
        return keccak256(abi.encode(
            INPUT_TYPE_HASH,
            utxo.blockNum(),
            utxo.txIndex(),
            uint256(utxo.outputIndex())
        ));
    }

    function _hashOutput(PaymentOutputModel.Output memory _output)
        private
        pure
        returns (bytes32)
    {
        if (_output.amount == 0) {
            return EMPTY_OUTPUT_HASH;
        }

        return keccak256(abi.encode(
            OUTPUT_TYPE_HASH,
            _output.outputGuard,
            _output.token,
            _output.amount
        ));
    }
}
