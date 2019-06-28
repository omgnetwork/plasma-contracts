pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./models/ExitModel.sol";
import "./interfaces/ExitProcessor.sol";
import "./registries/ExitGameRegistry.sol";
import "./utils/PriorityQueue.sol";

contract ExitGameController is ExitGameRegistry {
    uint64 private _exitQueueNonce = 1;
    mapping (uint256 => ExitModel.Exit) private _exits;
    mapping (address => PriorityQueue) private _exitsQueues;

    event TokenAdded(
        address token
    );

    event ProcessedExitsNum(
        uint256 processedNum,
        address token
    );

    constructor() public {
        address ethToken = address(0);
        _exitsQueues[ethToken] = new PriorityQueue();
    }

    function exitQueueNonce() public view returns (uint64) {
        return _exitQueueNonce;
    }

    /**
     * @dev Mimics the default getter for public mapping. Struct would be returned as a tuple with variable names.
     */
    function exits(uint256 _uniquePriority) public view returns (address exitProcessor, uint256 exitableAt, uint256 exitId) {
        ExitModel.Exit memory exit = _exits[_uniquePriority];
        return (exit.exitProcessor, exit.exitableAt, exit.exitId);
    }

    function exitsQueues(address _token) public view returns (PriorityQueue) {
        return _exitsQueues[_token];
    }

    /**
     * @notice Add token to the plasma framework and initiate the priority queue.
     * @notice ETH token is supported by default on deployment.
     * @dev the queue is created as a new contract instance.
     * @param _token Address of the token.
     */
    function addToken(address _token) external {
        require(!hasToken(_token), "Such token has already been added");

        _exitsQueues[_token] = new PriorityQueue();
        emit TokenAdded(_token);
    }

    /**
     * @notice Checks if queue for particular token was created.
     * @param _token Address of the token.
     * @return bool represents whether the queue for a token was created.
     */
    function hasToken(address _token) public view returns (bool) {
        return address(_exitsQueues[_token]) != address(0);
    }

    /**
     * @notice Enqueue exits from exit game contracts
     * @dev Unique priority is a combination of original priority and an increasing nonce
     * @dev Use public instead of external because structs in calldata not currently supported.
     * @param _priority The priority of the exit itself
     * @param _token Token for the exit
     * @param _exit Exit data that contains the basic information for exit processor that processes the exit
     * @return a unique priority number computed for the exit
     */
    function enqueue(uint192 _priority, address _token, ExitModel.Exit memory _exit) public onlyFromExitGame returns (uint256) {
        require(hasToken(_token), "Such token has not been added to the plasma framework yet");

        PriorityQueue queue = _exitsQueues[_token];
        uint256 uniquePriority = (uint256(_priority) << 64 | _exitQueueNonce);

        _exitQueueNonce++;
        queue.insert(uniquePriority);
        _exits[uniquePriority] = _exit;

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

        PriorityQueue queue = _exitsQueues[_token];
        require(queue.currentSize() > 0, "Exit queue is empty");

        uint256 uniquePriority = queue.getMin();
        require(_topUniquePriority == 0 || uniquePriority == _topUniquePriority,
            "Top unique priority of the queue is not the same as the specified one");

        ExitModel.Exit memory exit = _exits[uniquePriority];
        uint256 processedNum = 0;

        while (processedNum < _maxExitsToProcess && exit.exitableAt < block.timestamp) {
            ExitProcessor processor = ExitProcessor(exit.exitProcessor);

            processor.processExit(exit.exitId);

            delete _exits[uniquePriority];
            queue.delMin();
            processedNum++;

            if (queue.currentSize() == 0) {
                break;
            }

            uniquePriority = queue.getMin();
            exit = _exits[uniquePriority];
        }

        emit ProcessedExitsNum(processedNum, _token);
    }
}
