pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./interfaces/IExitProcessor.sol";
import "./registries/ExitGameRegistry.sol";
import "./utils/PriorityQueue.sol";
import "./utils/ExitPriority.sol";
import "../utils/TxPosLib.sol";

contract ExitGameController is ExitGameRegistry {

    mapping (uint256 => IExitProcessor) public delegations;
    mapping (uint256 => bool) public registeredVaults;
    mapping (bytes32 => PriorityQueue) public exitsQueues;
    mapping (bytes32 => bool) public isOutputSpent;

    event TokenAdded(
        uint256 vaultId,
        address token
    );

    event VaultAdded(
        uint256 vaultId
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
    }

    /**
     * @notice Returns true only if vault has been registered.
     * @param vaultId Id of the vault.
     */
    function hasVault(uint256 vaultId) public view returns (bool) {
        return registeredVaults[vaultId] == true;
    }

    /**
     * @notice Enables vault to be used for processing exits.
     * @dev the queue is created as a new contract instance.
     * @param vaultId Id of the vault.
     */
    function addVault(uint256 vaultId) external onlyOperator {
        require(vaultId != 0, "Vault id must not be 0");
        require(!hasVault(vaultId), "The vault has already been registered");
        registeredVaults[vaultId] = true;
        emit VaultAdded(vaultId);
    }

    /**
     * @notice Checks if queue for particular token was created.
     * @param vaultId Id of the vault that handles the token
     * @param token Address of the token.
     * @return bool represents whether the queue for a token was created.
     */
    function vaultHasToken(uint256 vaultId, address token) public view returns (bool) {
        bytes32 key = exitQueueKey(vaultId, token);
        return address(exitsQueues[key]) != address(0);
    }

    /**
     * @notice Add token to the plasma framework and initiate the priority queue.
     * @dev the queue is created as a new contract instance.
     * @param vaultId Id of the vault
     * @param token Address of the token.
     */
    function addToken(uint256 vaultId, address token) external {
        require(hasVault(vaultId), "Vault is not registered for funding exits");
        require(!vaultHasToken(vaultId, token), "Such token has already been added");
        bytes32 key = exitQueueKey(vaultId, token);
        exitsQueues[key] = new PriorityQueue();
        emit TokenAdded(vaultId, token);
    }

    function hasToken(bytes32 key) private view returns (bool) {
        return address(exitsQueues[key]) != address(0);
    }

    /**
     * @notice Enqueue exits from exit game contracts
     * @dev Caller of this function should add "pragma experimental ABIEncoderV2;" on top of file
     * @param vaultId Vault id of the vault that stores exiting funds
     * @param token Token for the exit
     * @param exitableAt The earliest time that such exit can be processed
     * @param txPos Transaction position for the exit priority. For SE it should be the exit tx, for IFE it should be the youngest input tx position.
     * @param exitId Id for the exit processor contract to understand how to process such exit
     * @param exitProcessor The exit processor contract that would be called during "processExits"
     * @return a unique priority number computed for the exit
     */
    function enqueue(uint256 vaultId, address token, uint64 exitableAt, TxPosLib.TxPos calldata txPos, uint160 exitId, IExitProcessor exitProcessor)
        external
        onlyFromNonQuarantinedExitGame
        returns (uint256)
    {
        bytes32 key = exitQueueKey(vaultId, token);
        require(hasToken(key), "Such token has not been added to the plasma framework yet");
        PriorityQueue queue = exitsQueues[key];

        uint256 uniquePriority = ExitPriority.computePriority(exitableAt, txPos, exitId);

        queue.insert(uniquePriority);
        delegations[uniquePriority] = exitProcessor;

        emit ExitQueued(exitId, uniquePriority);
        return uniquePriority;
    }

    /**
     * @notice Processes any exits that have completed the challenge period.
     * @param vaultId Vault id of the vault that stores exiting funds
     * @param token Token type to process.
     * @param topExitId Unique priority of the first exit that should be processed. Set to zero to skip the check.
     * @param maxExitsToProcess Maximal number of exits to process.
     * @return total number of processed exits
     */
    function processExits(uint256 vaultId, address token, uint160 topExitId, uint256 maxExitsToProcess) external {
        bytes32 key = exitQueueKey(vaultId, token);
        require(hasToken(key), "Such token has not been added to the plasma framework yet");
        PriorityQueue queue = exitsQueues[key];
        require(queue.currentSize() > 0, "Exit queue is empty");

        uint256 uniquePriority = queue.getMin();
        uint160 exitId = ExitPriority.parseExitId(uniquePriority);
        require(topExitId == 0 || exitId == topExitId,
            "Top exit id of the queue is not the same as the specified one");

        IExitProcessor processor = delegations[uniquePriority];
        uint256 processedNum = 0;

        while (processedNum < maxExitsToProcess && ExitPriority.parseExitableAt(uniquePriority) < block.timestamp) {
            delete delegations[uniquePriority];
            queue.delMin();
            processedNum++;

            processor.processExit(exitId, token);

            if (queue.currentSize() == 0) {
                break;
            }

            uniquePriority = queue.getMin();
            exitId = ExitPriority.parseExitId(uniquePriority);
            processor = delegations[uniquePriority];
        }

        emit ProcessedExitsNum(processedNum, token);
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

    function exitQueueKey(uint256 vaultId, address token) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(vaultId, token));
    }
}
