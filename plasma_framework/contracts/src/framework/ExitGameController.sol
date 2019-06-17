pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./models/ExitModel.sol";
import "./interfaces/ExitProcessor.sol";
import "./registries/ExitGameRegistry.sol";
import "./priorityQueue/PriorityQueue.sol";

contract ExitGameController is ExitGameRegistry {
    uint64 public exitQueueNonce = 1;
    mapping(uint256 => ExitModel.Exit) public exits;
    mapping (address => PriorityQueue) public exitsQueues;

    event TokenAdded(
        address token
    );

    event ProcessedExitsNum(
        uint256 processedNum,
        address token
    );

    /**
     * @notice Add token to the plasma framework and initiate the priority queue.
     * @dev the queue is created as a new contract instance.
     * @param _token Address of the token.
     */
    function addToken(address _token) external {
        require(!hasToken(_token), "Such token has already been added");

        address queueOwner = address(this);
        exitsQueues[_token] = new PriorityQueue(queueOwner);
        emit TokenAdded(_token);
    }

    /**
     * @notice Checks if queue for particular token was created.
     * @param _token Address of the token.
     * @return bool represents whether the queue for a token was created.
     */
    function hasToken(address _token) public view returns (bool) {
        return address(exitsQueues[_token]) != address(0);
    }

    /**
     * @notice Enqueue exits from exit game contracts
     * @dev Unique priority is a combination of original priority and an increasing nonce
     * @dev Use public instead of external because structs in calldata not currently supported.
     * @param _priority The priority of the exit itself
     * @param _token Token for the exit
     * @param _exit Exit data that contains the basic information for exit processor the process the exit
     * @return a unique priority number computed for the exit
     */
    function enqueue(uint192 _priority, address _token, ExitModel.Exit memory _exit) public onlyFromExitGame returns (uint256) {
        require(hasToken(_token), "Such token has not be added to the plasma framework yet");

        PriorityQueue queue = exitsQueues[_token];
        uint256 uniquePriority = (uint256(_priority) << 64 | exitQueueNonce);

        exitQueueNonce++;
        queue.insert(uniquePriority);
        exits[uniquePriority] = _exit;

        return uniquePriority;
    }

    /**
     * @notice Processes any exits that have completed the challenge period.
     * @param _token Token type to process.
     * @param _topUniquePriority Unique priority of first the exit that should be processed. Set to zero to skip the check.
     * @param _maxExitsToProcess Maximal number of exits to process.
     * @return total number of processed exits
     */
    function processExits(address _token, uint256 _topUniquePriority, uint256 _maxExitsToProcess) external {
        require(hasToken(_token), "Such token has not be added to the plasma framework yet");

        PriorityQueue queue = exitsQueues[_token];
        require(queue.currentSize() > 0, "Exit queue is empty");

        uint256 uniquePriority = queue.getMin();
        require(_topUniquePriority == 0 || uniquePriority == _topUniquePriority,
            "Top unique priority of the queue is not the same as the specified one");

        ExitModel.Exit memory exit = exits[uniquePriority];
        uint256 processedNum = 0;

        while (processedNum < _maxExitsToProcess && exit.exitableAt < block.timestamp) {
            ExitProcessor processor = ExitProcessor(exit.exitProcessor);

            processor.processExit(exit.exitId);

            delete exits[uniquePriority];
            queue.delMin();
            processedNum++;

            if (queue.currentSize() == 0) {
                break;
            }

            uniquePriority = queue.getMin();
            exit = exits[uniquePriority];
        }

        emit ProcessedExitsNum(processedNum, _token);
    }
}
