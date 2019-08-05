pragma solidity ^0.5.0;

import "./interfaces/IExitProcessor.sol";
import "./registries/ExitGameRegistry.sol";
import "./utils/PriorityQueue.sol";
import "./utils/ExitPriority.sol";

contract ExitGameController is ExitGameRegistry {
    uint64 public exitQueueNonce = 1;
    mapping (uint256 => Exit) public exits;
    mapping (address => PriorityQueue) public exitsQueues;
    mapping (bytes32 => bool) public isOutputSpent;

    struct Exit {
        IExitProcessor exitProcessor;
        uint192 exitId; // This is for each exit game contract to design
    }

    event TokenAdded(
        address token
    );

    event ProcessedExitsNum(
        uint256 processedNum,
        address token
    );

    constructor(uint256 _minExitPeriod, uint256 _initialImmuneExitGames)
        public
        ExitGameRegistry(_minExitPeriod, _initialImmuneExitGames)
    {
        address ethToken = address(0);
        exitsQueues[ethToken] = new PriorityQueue();
    }

    /**
     * @notice Add token to the plasma framework and initiate the priority queue.
     * @notice ETH token is supported by default on deployment.
     * @dev the queue is created as a new contract instance.
     * @param _token Address of the token.
     */
    function addToken(address _token) external {
        require(!hasToken(_token), "Such token has already been added");

        exitsQueues[_token] = new PriorityQueue();
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
     * @dev Unique priority is a combination of original priority (exitable timestamp) and an increasing nonce
     * @param _token Token for the exit
     * @param _exitableAt The earliest time that such exit can be processed
     * @param _exitId Id for the exit processor contract to understand how to process such exit
     * @param _exitProcessor The exit processor contract
     * @return a unique priority number computed for the exit
     */
    function enqueue(address _token, uint64 _exitableAt, uint192 _exitId, IExitProcessor _exitProcessor)
        external
        onlyFromNonQuarantinedExitGame
        returns (uint256)
    {
        require(hasToken(_token), "Such token has not been added to the plasma framework yet");

        PriorityQueue queue = exitsQueues[_token];

        uint256 uniquePriority = ExitPriority.computePriority(_exitableAt, exitQueueNonce);
        exitQueueNonce++;

        queue.insert(uniquePriority);

        exits[uniquePriority] = Exit({
            exitProcessor: _exitProcessor,
            exitId: _exitId
        });

        return uniquePriority;
    }

    /**
     * @notice Processes any exits that have completed the challenge period.
     * @param _token Token type to process.
     * @param _topUniquePriority Unique priority of the first exit that should be processed. Set to zero to skip the check.
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

        Exit memory exit = exits[uniquePriority];
        uint256 processedNum = 0;

        while (processedNum < _maxExitsToProcess && ExitPriority.parseExitableAt(uniquePriority) < block.timestamp) {
            IExitProcessor processor = exit.exitProcessor;

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

    /**
     * @notice Checks if any of the output with the given outputIds is spent already.
     * @param _outputIds Output ids to be checked.
     */
    function isAnyOutputsSpent(bytes32[] calldata _outputIds) external view returns (bool) {
        for (uint i = 0 ; i < _outputIds.length ; i++) {
            if (isOutputSpent[_outputIds[i]] == true) {
                return true;
            }
        }
        return false;
    }

    /**
     * @notice Batch flags outputs that is spent
     * @param _outputIds Output ids to be flagged
     */
    function batchFlagOutputsSpent(bytes32[] calldata _outputIds) external onlyFromNonQuarantinedExitGame {
        for (uint i = 0 ; i < _outputIds.length ; i++) {
            isOutputSpent[_outputIds[i]] = true;
        }
    }

    /**
     * @notice Flags a single outputs as spent
     * @param _outputId The output id to be flagged as spent
     */
    function flagOutputSpent(bytes32 _outputId) external onlyFromNonQuarantinedExitGame {
        isOutputSpent[_outputId] = true;
    }
}
