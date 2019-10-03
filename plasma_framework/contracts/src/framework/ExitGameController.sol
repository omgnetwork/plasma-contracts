pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "./interfaces/IExitProcessor.sol";
import "./registries/ExitGameRegistry.sol";
import "./utils/PriorityQueue.sol";
import "./utils/ExitPriority.sol";
import "../utils/TxPosLib.sol";

/**
 * @notice Controls the logic and functions for ExitGame to interact with PlasmaFramework.
 */
contract ExitGameController is ExitGameRegistry {
    mapping (uint256 => IExitProcessor) public delegations;
    mapping (address => PriorityQueue) public exitsQueues;
    mapping (bytes32 => bool) public isOutputSpent;

    event TokenAdded(
        address token
    );

    event ProcessedExitsNum(
        uint256 processedNum,
        address token
    );

    event ExitQueued(
        uint160 indexed exitId,
        uint256 uniquePriority
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
     * @notice Checks if the queue for a particular token was created.
     * @param _token address of the token.
     * @return bool whether the queue for a token was created.
     */
    function hasToken(address _token) public view returns (bool) {
        return address(exitsQueues[_token]) != address(0);
    }

    /**
     * @notice Enqueue exits from exit game contracts
     * @dev emits ExitQueued event. The event can be used to back trace the priority inside the queue.
     * @dev Caller of this function should add "pragma experimental ABIEncoderV2;" on top of file
     * @param _token Token for the exit
     * @param _exitableAt The earliest time that such exit can be processed
     * @param _txPos Transaction position for the exit priority. For SE it should be the exit tx, for IFE it should be the youngest input tx position.
     * @param _exitId Id for the exit processor contract to understand how to process such exit
     * @param _exitProcessor The exit processor contract that would be called during "processExits"
     * @return a unique priority number computed for the exit
     */
    function enqueue(address _token, uint64 _exitableAt, TxPosLib.TxPos calldata _txPos, uint160 _exitId, IExitProcessor _exitProcessor)
        external
        onlyFromNonQuarantinedExitGame
        returns (uint256)
    {
        require(hasToken(_token), "Such token has not been added to the plasma framework yet");
        PriorityQueue queue = exitsQueues[_token];

        uint256 uniquePriority = ExitPriority.computePriority(_exitableAt, _txPos, _exitId);

        queue.insert(uniquePriority);
        delegations[uniquePriority] = _exitProcessor;

        emit ExitQueued(_exitId, uniquePriority);
        return uniquePriority;
    }

    /**
     * @notice Processes any exits that have completed the challenge period.
     * @dev emits ProcessedExitsNum event.
     * @param _token token type to process.
     * @param _topExitId unique priority of the first exit that should be processed. Set to zero to skip the check.
     * @param _maxExitsToProcess maximal number of exits to process.
     * @return total number of processed exits
     */
    function processExits(address _token, uint160 _topExitId, uint256 _maxExitsToProcess) external {
        require(hasToken(_token), "Such token has not been added to the plasma framework yet");

        PriorityQueue queue = exitsQueues[_token];
        require(queue.currentSize() > 0, "Exit queue is empty");

        uint256 uniquePriority = queue.getMin();
        uint160 exitId = ExitPriority.parseExitId(uniquePriority);
        require(_topExitId == 0 || exitId == _topExitId,
            "Top exit id of the queue is not the same as the specified one");

        IExitProcessor processor = delegations[uniquePriority];
        uint256 processedNum = 0;

        while (processedNum < _maxExitsToProcess && ExitPriority.parseExitableAt(uniquePriority) < block.timestamp) {
            delete delegations[uniquePriority];
            queue.delMin();
            processedNum++;

            processor.processExit(exitId, _token);

            if (queue.currentSize() == 0) {
                break;
            }

            uniquePriority = queue.getMin();
            exitId = ExitPriority.parseExitId(uniquePriority);
            processor = delegations[uniquePriority];
        }

        emit ProcessedExitsNum(processedNum, _token);
    }

    /**
     * @notice Checks if any of the output with the given outputIds is spent already.
     * @param _outputIds Output ids to be checked.
     */
    function isAnyOutputsSpent(bytes32[] calldata _outputIds) external view returns (bool) {
        for (uint i = 0; i < _outputIds.length; i++) {
            if (isOutputSpent[_outputIds[i]] == true) {
                return true;
            }
        }
        return false;
    }

    /**
     * @notice Batch flags outputs that are spent
     * @param _outputIds Output ids to be flagged
     */
    function batchFlagOutputsSpent(bytes32[] calldata _outputIds) external onlyFromNonQuarantinedExitGame {
        for (uint i = 0; i < _outputIds.length; i++) {
            require(_outputIds[i] != bytes32(""), "Should not flag with empty outputId");
            isOutputSpent[_outputIds[i]] = true;
        }
    }

    /**
     * @notice Flags a single output as spent
     * @param _outputId The output id to be flagged as spent
     */
    function flagOutputSpent(bytes32 _outputId) external onlyFromNonQuarantinedExitGame {
        require(_outputId != bytes32(""), "Should not flag with empty outputId");
        isOutputSpent[_outputId] = true;
    }
}
