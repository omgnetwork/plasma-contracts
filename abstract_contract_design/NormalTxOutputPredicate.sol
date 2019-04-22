pragma solidity ^0.5.0;

import "./TxOutputPredicateInterface.sol";
import "./TxModels.sol";
import "./ECRecovery.sol";

contract NormalTxOutputPredicate is TxOutputPredicate {
    uint256 NORMAL_TYPE = 1; // example type number

    function canUseTxOutput(bytes calldata _txOutput, bytes calldata _consumeTx, uint256 _consumeTxType) external returns (bool) {
        NormalTxOutputModel.TxOutput memory output = NormalTxOutputModel.decode(_txOutput);
        if (_consumeTxType == NORMAL_TYPE) {
            NormalTxModel.Tx memory consumeTx = NormalTxModel.decode(_consumeTx);
            bytes32 txHash = keccak256(_consumeTx);
            return ECRecovery.recover(txHash, consumeTx.proofData.signature) == output.outputData.owner;
        }
        return false;
    }
}