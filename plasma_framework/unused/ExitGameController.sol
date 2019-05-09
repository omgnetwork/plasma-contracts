pragma solidity ^0.4.0;

// Should be safe to use. It is marked as experimental as it costs higher gas usage.
// see: https://github.com/ethereum/solidity/issues/5397
pragma experimental ABIEncoderV2;

import "./ExitGameRegistry.sol";
import "./PlasmaStorage.sol";
import "./ExitModel.sol";


contract ExitGameController is ExitGameRegistry, PlasmaStorage {
    /**
     * @dev Proxy function that calls the app contract to run the specific interactive game function.
     * @param _txType tx type. each type has its own exit game contract.
     * @param _encodedFunctionData Encoded function data, including function abi and input variables.
            eg. for a function "f(uint 256)", this value should be abi.encodeWithSignature("f(uint256)", var1)
     */
    function runExitGame(uint256 _txType, bytes _encodedFunctionData) external {
//        (bool success,) = getExitGameContract(_txType).call(_encodedFunctionData);
        bool success = getExitGameContract(_txType).call(_encodedFunctionData);
        require(success);
    }

    /**
     * @dev Enqueue an exit to priority queue.
     * @param _exit Data for exit.
     */
    function enqueue(ExitModel.Exit _exit) external {
        /** Pseudo code

            // use `exitQueueNonce` to make sure uniqueness of the queue priority.
            uniquePriority = combineToUniquePriority(exit.priority, exitQueueNonce);
            priorityQueue.enqueue(uniquePriority);
            exits[uniquePriority] = exit;
            exitQueueNonce ++;
         */
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