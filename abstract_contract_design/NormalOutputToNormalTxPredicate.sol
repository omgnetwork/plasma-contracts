pragma solidity ^0.5.0;

import "./TxOutputPredicateInterface.sol";
import "./TxModels.sol";
import "./ECRecovery.sol";

contract NormalOutputToNormalTxPredicate is TxOutputPredicate {
    function canUseTxOutput(bytes calldata _txOutput, bytes calldata _consumeTx) external returns (bool) {
        NormalTxOutputModel.TxOutput memory output = NormalTxOutputModel.decode(_txOutput);
        NormalTxModel.Tx memory consumeTx = NormalTxModel.decode(_consumeTx);
        bytes32 txHash = keccak256(_consumeTx);
        return ECRecovery.recover(txHash, consumeTx.proofData.signature) == output.outputData.owner;
    }
}