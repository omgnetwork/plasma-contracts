pragma solidity 0.5.11;

pragma experimental ABIEncoderV2;

import "../../src/utils/RLPReader.sol";
import "../../src/transactions/PaymentTransactionModel.sol";

contract RLPMockSecurity {

    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;
    using PaymentTransactionModel for PaymentTransactionModel.Transaction;

    /*
     * Expose the RLP based decoding functions that are used to decode payment txs
     */ 
    function decodeBytes32(bytes memory _data) public pure returns (bytes32) {
        return bytes32(_data.toRlpItem().toUint());
    }

    function decodeBytes20(bytes memory _data) public pure returns (bytes20) {
        return bytes20(_data.toRlpItem().toAddress());
    }

    function decodeUint(bytes memory _data) public pure returns (uint) {
        return _data.toRlpItem().toUint();
    }

    function decodeList(bytes memory _data) public pure returns (RLPReader.RLPItem[] memory) {
        return _data.toRlpItem().toList();
    }

    /*
     * Property Test for an encoded deposit tx 
     * A deposit tx with a different encoded tx but the same decoded PaymentTransactionModel values triggers an assertion violation 
     */ 
    function validateDepositTx1(bytes memory encTx) private {
        PaymentTransactionModel.Transaction memory decTx = PaymentTransactionModel.decode(encTx);
        require(decTx.txType == 1, "Invalid tx type");
        require(decTx.inputs.length == 0, "Invalid number of inputs");
        require(decTx.outputs.length == 1, "Invalid number of outputs");
        require(decTx.outputs[0].outputType == 1, "Invalid outputType");
        require(decTx.outputs[0].outputGuard == bytes20(hex'd42b31665b93c128541c8b89a0e545afb08b7dd8'), "Invalid outputGuard");
        require(decTx.outputs[0].token == 0x0000000000000000000000000000000000000000, "Invalid token");
        require(decTx.outputs[0].amount == 1000000000000000, "Invalid amount");
        require(decTx.txData == 0, "Invalid txData");
        require(decTx.metaData == hex'00', "Invalid metaData");
    }

    function propertyTestDepositTx1(bytes memory mutTx) public {
        bytes memory depositTx1 = hex'f85a01c0f5f401f294d42b31665b93c128541c8b89a0e545afb08b7dd894000000000000000000000000000000000000000087038d7ea4c6800080a00000000000000000000000000000000000000000000000000000000000000000';
        validateDepositTx1(mutTx);
        assert(keccak256(depositTx1) == keccak256(mutTx));
    }
}
