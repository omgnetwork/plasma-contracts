pragma solidity ^0.5.0;

import "./ExitGameRegistrator.sol";
import "./PlasmaStorage.sol";
import "./ExitModel.sol";


contract ExitGameController is ExitGameRegistrator, PlasmaStorage {
    /**
     * @dev Proxy function that calls the app contract to run the specific interactive game function.
     * @param _exitGame name of the exit game.
     * @param _encodedFunctionData Encoded function data, including function abi and input variables. 
            eg. for a function "f(uint 256)", this value should be abi.encodeWithSignature("f(uint256)", var1)
     */
    function runExitGame(bytes32 _exitGame, bytes calldata _encodedFunctionData) external {
        (bool success,) = getExitGameContract(_exitGame).call(_encodedFunctionData);
        require(success);
    }

    /**
     * @dev Enqueue an exit to priority queue.
     * @param _exit Data for exit.
     */
    function enqueue(ExitModel.Exit calldata _exit) external {
        /** Pseudo code
        
            uniquePriority = combineToUniquePriority(exit.priority, exitQueueNonce);
            priorityQueue.enqueue(uniquePriority);
            exits[uniquePriority] = exit;
            exitQueueNonce ++;
         */
    }

     /**
     * @dev Processes any exits that have completed the challenge period.
     * @param _token Token type to process.
     * @param _topExitId First exit that should be processed. Set to zero to skip the check.
     * @param _exitsToProcess Maximal number of exits to process.
     */
    function processExits(address _token, uint192 _topExitId, uint256 _exitsToProcess) external {
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