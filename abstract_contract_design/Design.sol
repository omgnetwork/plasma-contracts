pragma solidity ^0.5.0;

// Should be safe to use. It is marked as experimental as it costs higher gas usage.
// see: https://github.com/ethereum/solidity/issues/5397 
pragma experimental ABIEncoderV2;


import "./GeneralizedStorage.sol";
import "./PlasmaWallet.sol";
import "./ExitGameController.sol";

contract PlasmaBlockContoller {
    function submitBlock(bytes32 _blockRoot) public;
}

contract PlasmaFramework is PlasmaBlockContoller, PlasmaWallet, ExitGameController, GeneralizedStorage {
}

interface ExitGame {
    /**
     * @dev Check the result of exit game, whether an exit is able to process or not (is successfully challenged or not).
     * @param _exitId Unique identifier of exit within the exit game.
     */
    function isExitValid(bytes32 _exitId) external pure returns (bool);

    /**
     * @dev Custom function to proces exit.
     * @param _exit Exit data.
     */
    function processExit(ExitModel.Exit calldata _exit) external;
}

/**
For simpleness, use MVP instead of MoreVP as example.
Basically the ExitGame implementation should define their own game function.
 */
contract MVPGame is ExitGame {
    address parentContract;
    bytes32 name;

    constructor(address _parentContract, bytes32 _name) public {
        /** 
            Exit Game would call parent contract for:
            1. Access to storage. All state storage is in parent contract (for upgradeability). 
            2. Process the withdraw from plasma chain to root chain. See "PlasmaWallet.sol".
         */
        parentContract = _parentContract;
        name = _name;
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

            parentContract.setBoolStorage(name, keyExitValid, true);
            parentContract.setUintStorage(name, keyAmount, txOutput.amount);
            parentContract.setAddressStorage(name, keyToken, txOutput.token);
            parentContract.setAddressStorage(name, keyExitTo, txOutput.owner);

            parentContract.enqueue(exit);

         */
    }

    function challengeExit(uint256 _exitId) external {
        /**
            checkChallengeValid();

            keyExitValid = concat(_exitId, "-isValid");
            parentContract.setBoolStorage(name, keyExitValid, false);
         */
    }

    function isExitValid(bytes32 _exitId) external pure returns (bool) {
        /**
            keyExitValid = concat(_exitId, "-isValid");
            return parentContract.getBoolStorage(name, keyExitValid, false);
         */
    }

    function processExit(ExitModel.Exit calldata _exit) external {
        /**
            keyToken = concat(exitId, "-token");
            keyExitTo = concat(exitId, "-exitTo");
            keyAmount = concat(exitId, "-amount");

            token = parentContract.getAddressStorage(name, keyToken);
            exitTo = parentContract.getAddressStorage(name, keyExitTo);
            amount = parentContract.getAddressStorage(name, keyAmount);

            parentContract.withdrawErc20(token, exitTo, amount);
         */
    }
}

/**
This defines exit game for ODEX funding tx.
Tx output can be exit to input owner but not output (exchange).
However, tx output can be used in ODEX batch settlement tx with exchange signature and correct order.
 */
contract OdexFundingTxExitGame is ExitGame {}

/**
This defines exit game for ODEX batch settlemet tx.
 */
contract OdexBatchSettlementTxExitGame is ExitGame {}
