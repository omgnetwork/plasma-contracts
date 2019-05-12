pragma solidity ^0.4.0;

// Should be safe to use. It is marked as experimental as it costs higher gas usage.
// see: https://github.com/ethereum/solidity/issues/5397
pragma experimental ABIEncoderV2;

import "./ExitGameRegistry.sol";
import "./TxModel.sol";

contract ExitGameController is ExitGameRegistry {
    struct Exit {
        ExitGame exitGameContract;
        TxModel.Tx tx;
        bytes exitData;
    }

    // NOTE: exitId must be unique among all exit games
    mapping (uint192 => Exit) public exits; // exitID => Exit

    function setExitData(uint256 _txType, uint192 _exitId, Exit _exit) external {
        require(exitGames[_txType] == msg.sender);
        exits[_exitId] = _exit;
    }

    /**
     * @dev Enqueue an exit to priority queue.
     * @param _token token being exited
     * @param _exit Data for exit.
     */
    function enqueue(address _token, uint256 _exitId) external {
        // TODO: Enqueue exit in a corresponding queue
    }

    /**
    * @dev Processes any exits that have completed the challenge period.
    * @param _token Token type to process.
    * @param _topUniquePriority First exit that should be processed. Set to zero to skip the check.
    * @param _exitsToProcess Maximal number of exits to process.
    */
    function processExits(address _token, uint192 _topUniquePriority, uint256 _exitsToProcess) external {
        /** Pseudo code
            while(exitableTimestamp < block.timestamp && _exitsToProcess > 0) {
                if (exit.exitGameContract.isExitValid(exit.exitId)) {
                    queue.delMin();
                    exit = exits[uniquePriority] ;
                    exit.exitGameContract.processExit(exit);
                }

                if (queue.currentSize() == 0) {
                    return;
                }
            }
         */
    }
}