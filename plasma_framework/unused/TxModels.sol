pragma solidity ^0.4.0;

library NormalTxInputModel {
    struct TxInput {
        uint256 blknum;
        uint256 txindex;
        uint256 oindex;
    }
}

library NormalTxOutputModel {
    struct TxOutputData {
        uint256 amount;
        address owner;
        address token;
    }

    struct TxOutput {
        uint256 outputType;
        TxOutputData outputData;
    }

//    function decode(bytes memory _txOutput) internal pure returns (TxOutput memory) {
//        // dummy implement
//        return TxOutput(1, TxOutputData(10, address(0), address(0)));
//    }
}

library NormalTxModel {
    struct ProofData {
        bytes signature;
    }

    struct MetaData {
        bytes32 data;
    }

    struct Tx {
        NormalTxInputModel.TxInput[] inputs;
        NormalTxOutputModel.TxOutput[] outputs;
        ProofData proofData;
        MetaData metaData;
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