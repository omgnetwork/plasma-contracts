pragma solidity ^0.5.0;

import "./TxModels.sol";
import "./TxOutputPredicateInterface.sol";
import "./PlasmaFramework.sol";

/**
For simpleness, use MVP instead of MoreVP as example.
Basically the ExitGame implementation should define their own game function.
 */
contract MVPGame {
    PlasmaFramework parent;
    uint256 txType;

    constructor(address _parentContract, uint256 _txType) public {
        /** 
            Exit Game would call parent contract for:
            1. Access to storage. All state storage is in parent contract (for upgradeability). 
            2. Process the withdraw from plasma chain to root chain. See "PlasmaWallet.sol".
         */
        parent = PlasmaFramework(_parentContract);
        txType = _txType;
    }

    // Each type of tx defines their own exit game logic.
    // in the end, call `parentContract.enqueue(exit)` to push into the queue
    function startExit(uint192 _utxoPos, bytes calldata _outputTx, bytes calldata _outputTxInclusionProof) external {
        /** Pseudo code
            
            checkInclusionProof(_outputTx, _outputTxInclusionProof);
            txOutput = parseTx(_outputTx, _utxoPos)
            
            priority = _getPriority(utxoPos);
            exitId = priority; // in MVP priority is unique already, not in MoreVP.

            keyAmount = concat(exitId, "-amount");
            keyToken = concat(exitId, "-token");
            keyExitTo = concat(exitId, "-exitTo");
            keyExitValid = concat(exitId, "-isValid");

            parent.setBoolStorage(txType, keyExitValid, true);
            parent.setUintStorage(txType, keyAmount, txOutput.amount);
            parent.setAddressStorage(txType, keyToken, txOutput.token);
            parent.setAddressStorage(txType, keyExitTo, txOutput.owner);

            parent.enqueue(exit);
         */
    }

    function challengeExit(uint256 _exitId, bytes calldata _txout, uint256 _txOutputType, bytes calldata _challengeTx, uint256 _challengeTxType) external {
        TxOutputPredicate predicate = parent.getTxoutPredicate(_txOutputType, _challengeTxType);
        
        if(predicate.canUseTxOutput(_txout, _challengeTx)) {
            bytes32 keyExitValid = keccak256(abi.encodePacked(_exitId, "-isValid"));
            parent.setBoolStorage(txType, keyExitValid, false); // flag exit invalid
        }
    }
}