pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./interfaces/IExitProcessor.sol";
import "./registries/ExitGameRegistry.sol";
import "./utils/PriorityQueue.sol";
import "./utils/ExitPriority.sol";
import "../utils/TxPosLib.sol";

contract ExitGameController is ExitGameRegistry {
    uint64 public exitQueueNonce = 1;
    mapping (uint256 => Exit) public exits;
    mapping (address => PriorityQueue) public exitsQueues;
    mapping (bytes32 => bool) public isOutputSpent;

    struct Exit {
        IExitProcessor exitProcessor;
        uint192 exitId; // The id for exit processor to identify specific exit within an exit game.
    }

    event ErcContractAdded(
        address ercContract
    );

    event ProcessedExitsNum(
        uint256 processedNum,
        address ercContract
    );

    event ExitQueued(
        uint192 indexed exitId,
        uint256 uniquePriority
    );

    constructor(uint256 _minExitPeriod, uint256 _initialImmuneExitGames)
        public
        ExitGameRegistry(_minExitPeriod, _initialImmuneExitGames)
    {
        address ethErcContractRepresentive = address(0);
        exitsQueues[ethErcContractRepresentive] = new PriorityQueue();
    }

    /**
     * @notice Add ERC contract to the plasma framework and initiate the priority queue.
     * @dev ETH as address(0) is supported by default on deployment.
     * @dev the queue is created as a new contract instance.
     * @dev Each ERC contract has a queue so that each untrusted external contract would only impact its own queue
     * @param _ercContract Address of the erc contract.
     */
    function addErcContract(address _ercContract) external {
        require(!hasQueueForErcContract(_ercContract), "Such ERC contract has already been added");

        exitsQueues[_ercContract] = new PriorityQueue();
        emit ErcContractAdded(_ercContract);
    }

    /**
     * @notice Checks if queue for particular ERC contract was created.
     * @param _ercContract Address of the ERC contract. Use address(0) for ETH.
     * @return bool represents whether the queue for a ERC contract was created.
     */
    function hasQueueForErcContract(address _ercContract) public view returns (bool) {
        return address(exitsQueues[_ercContract]) != address(0);
    }

    /**
     * @notice Enqueue exits from exit game contracts
     * @dev Caller of this function should add "pragma experimental ABIEncoderV2;" on top of file
     * @param _ercContract Address of the ERC contract. Use address(0) for ETH.
     * @param _exitableAt The earliest time that such exit can be processed
     * @param _txPos Transaction position for the exit priority. For SE it should be the exit tx, for IFE it should be the youngest input tx position.
     * @param _exitId Id for the exit processor contract to understand how to process such exit
     * @param _exitProcessor The exit processor contract that would be called during "processExits"
     * @return a unique priority number computed for the exit
     */
    function enqueue(address _ercContract, uint64 _exitableAt, TxPosLib.TxPos calldata _txPos, uint192 _exitId, IExitProcessor _exitProcessor)
        external
        onlyFromNonQuarantinedExitGame
        returns (uint256)
    {
        require(hasQueueForErcContract(_ercContract), "Such ERC contract has not been added to the plasma framework yet");

        PriorityQueue queue = exitsQueues[_ercContract];

        uint256 uniquePriority = ExitPriority.computePriority(_exitableAt, _txPos, exitQueueNonce);
        exitQueueNonce++;

        queue.insert(uniquePriority);

        exits[uniquePriority] = Exit({
            exitProcessor: _exitProcessor,
            exitId: _exitId
        });

        emit ExitQueued(_exitId, uniquePriority);

        return uniquePriority;
    }

    /**
     * @notice Processes any exits that have completed the challenge period.
     * @param _ercContract Address of the ERC contract. Use address(0) for ETH.
     * @param _topUniquePriority Unique priority of the first exit that should be processed. Set to zero to skip the check.
     * @param _maxExitsToProcess Maximal number of exits to process.
     * @return total number of processed exits
     */
    function processExits(address _ercContract, uint256 _topUniquePriority, uint256 _maxExitsToProcess) external {
        require(hasQueueForErcContract(_ercContract), "Such ERC contract has not been added to the plasma framework yet");

        PriorityQueue queue = exitsQueues[_ercContract];
        require(queue.currentSize() > 0, "Exit queue is empty");

        uint256 uniquePriority = queue.getMin();
        require(_topUniquePriority == 0 || uniquePriority == _topUniquePriority,
            "Top unique priority of the queue is not the same as the specified one");

        Exit memory exit = exits[uniquePriority];
        uint256 processedNum = 0;

        while (processedNum < _maxExitsToProcess && ExitPriority.parseExitableAt(uniquePriority) < block.timestamp) {
            delete exits[uniquePriority];
            queue.delMin();
            processedNum++;

            IExitProcessor processor = exit.exitProcessor;
            processor.processExit(exit.exitId, _ercContract);

            if (queue.currentSize() == 0) {
                break;
            }

            uniquePriority = queue.getMin();
            exit = exits[uniquePriority];
        }

        emit ProcessedExitsNum(processedNum, _ercContract);
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
     * @notice Batch flags outputs that is spent
     * @param _outputIds Output ids to be flagged
     */
    function batchFlagOutputsSpent(bytes32[] calldata _outputIds) external onlyFromNonQuarantinedExitGame {
        for (uint i = 0; i < _outputIds.length; i++) {
            require(_outputIds[i] != bytes32(""), "Should not flag with empty outputId");
            isOutputSpent[_outputIds[i]] = true;
        }
    }

    /**
     * @notice Flags a single outputs as spent
     * @param _outputId The output id to be flagged as spent
     */
    function flagOutputSpent(bytes32 _outputId) external onlyFromNonQuarantinedExitGame {
        require(_outputId != bytes32(""), "Should not flag with empty outputId");
        isOutputSpent[_outputId] = true;
    }
}
