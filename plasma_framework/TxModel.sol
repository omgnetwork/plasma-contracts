pragma solidity ^0.4.0;



library TxModel {

    struct TxInput {
        uint256 blknum;
        uint256 txindex;
        uint256 oindex;
    }

    struct TxOutput {
        uint256 outputType;
        bytes data;
    }

    struct Tx {
        uint256 txType;
        TxInput[] inputs;
        TxOutput[] outputs;
        bytes32 medata;
        bytes data; // here go signatures
    }

//    function decode(bytes memory _tx) internal pure returns (Tx) {
//        // dummy implement
//        NormalTxInputModel.TxInput[] memory ins = new NormalTxInputModel.TxInput[](1);
//        NormalTxOutputModel.TxOutput[] memory outs = new NormalTxOutputModel.TxOutput[](1);
//
//        NormalTxInputModel.TxInput memory dummyTxIn = NormalTxInputModel.TxInput(0, 0, 0);
//        NormalTxOutputModel.TxOutput memory dummyTxOut = NormalTxOutputModel.TxOutput(1, NormalTxOutputModel.TxOutputData(10, address(0), address(0)));
//
//        ins[0] = dummyTxIn;
//        outs[0] = dummyTxOut;
//        return Tx(ins, outs, ProofData(bytes("signature")), MetaData(""));
//
//    }
}