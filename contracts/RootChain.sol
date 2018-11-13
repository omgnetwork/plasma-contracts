pragma solidity ^0.4.0;

import "./Bits.sol";
import "./ByteUtils.sol";
import "./ECRecovery.sol";
import "./Math.sol";
import "./SafeMath.sol";
import "./Merkle.sol";
import "./RLP.sol";
import "./PlasmaCore.sol";
import "./PriorityQueue.sol";

import "./ERC20.sol";


/**
 * @title RootChain
 * @dev Represents a MoreVP Plasma chain.
 */
contract RootChain {
    using Bits for uint64;
    using Bits for uint256;
    using SafeMath for uint256;
    using ByteUtils for bytes;
    using RLP for bytes;
    using RLP for RLP.RLPItem;
    using PlasmaCore for bytes;
    using PlasmaCore for PlasmaCore.TransactionInput;
    using PlasmaCore for uint192;
    using PlasmaCore for uint256;


    /*
     * Storage
     */

    uint256 constant public MIN_EXIT_PERIOD = 1 weeks;
    uint256 constant public CHILD_BLOCK_INTERVAL = 1000;

    // WARNING: These placeholder bond values are entirely arbitrary.
    uint256 public standardExitBond = 31415926535 wei;
    uint256 public inFlightExitBond = 31415926535 wei;
    uint256 public piggybackBond = 31415926535 wei;

    address public operator;

    uint256 public nextChildBlock;
    uint256 public nextDepositBlock;

    mapping (uint256 => Block) public blocks;
    mapping (uint192 => Exit) public exits;
    mapping (uint192 => InFlightExit) public inFlightExits;
    mapping (address => address) public exitsQueues;

    bytes32[16] zeroHashes;

    struct Block {
        bytes32 root;
        uint256 timestamp;
    }

    struct Exit {
        address owner;
        address token;
        uint256 amount;
    }

    struct InFlightExit {
        uint256 exitStartTimestamp;
        uint256 exitMap;
        PlasmaCore.TransactionOutput[4] inputs;
        PlasmaCore.TransactionOutput[4] outputs;
        address bondOwner;
        uint256 oldestCompetitor;
    }


    /*
     * Events
     */

    event BlockSubmitted(
        uint256 blockNumber
    );

    event TokenAdded(
        address token
    );

    event DepositCreated(
        address indexed depositor,
        address indexed token,
        uint256 amount
    );

    event ExitStarted(
        address indexed owner,
        uint256 outputId,
        uint256 amount,
        address token
    );

    event ExitBlocked(
        address indexed challenger,
        uint256 outputId
    );

    event InFlightExitStarted(
        address indexed initiator,
        bytes32 txHash
    );

    event InFlightExitPiggybacked(
        address indexed owner,
        bytes32 txHash,
        uint256 outputIndex
    );

    event InFlightExitChallenged(
        address indexed challenger,
        bytes32 txHash,
        uint256 challengeTxPosition
    );

    event InFlightExitOutputBlocked(
        address indexed challenger,
        bytes32 txHash,
        uint256 outputId
    );


    /*
     * Modifiers
     */

    modifier onlyOperator() {
        require(msg.sender == operator);
        _;
    }

    modifier onlyWithValue(uint256 _value) {
        require(msg.value == _value);
        _;
    }


    /*
     * Constructor
     */

    constructor()
        public
    {
        operator = msg.sender;

        nextChildBlock = CHILD_BLOCK_INTERVAL;
        nextDepositBlock = 1;

        // Support only ETH on deployment; other tokens need
        // to be added explicitly.
        exitsQueues[address(0)] = address(new PriorityQueue());

        // Pre-compute some hashes to save gas later.
        bytes32 zeroHash = keccak256(abi.encodePacked(uint256(0)));
        for (uint i = 0; i < 16; i++) {
            zeroHashes[i] = zeroHash;
            zeroHash = keccak256(abi.encodePacked(zeroHash, zeroHash));
        }
    }


    /*
     * Public functions
     */

    // @dev Allows anyone to add new token to Plasma chain
    // @param token The address of the ERC20 token
    function addToken(address _token)
        public
    {
        require(!hasToken(_token));
        exitsQueues[_token] = address(new PriorityQueue());
        TokenAdded(_token);
    }

    /**
     * @dev Allows the operator to submit a child block.
     * @param _blockRoot Merkle root of the block.
     */
    function submitBlock(bytes32 _blockRoot)
        public
        onlyOperator
    {
        uint256 submittedBlockNumber = nextChildBlock;
        // Create the block.
        blocks[submittedBlockNumber] = Block({
            root: _blockRoot,
            timestamp: block.timestamp
        });

        // Update the next child and deposit blocks.
        nextChildBlock += CHILD_BLOCK_INTERVAL;
        nextDepositBlock = 1;

        emit BlockSubmitted(submittedBlockNumber);
    }

    /**
     * @dev Allows a user to submit a deposit.
     * @param _depositTx RLP encoded transaction to act as the deposit.
     */
    function deposit(bytes _depositTx)
        public
        payable
    {
        // Only allow a limited number of deposits per child block.
        require(nextDepositBlock < CHILD_BLOCK_INTERVAL);

        // Decode the transaction.
        PlasmaCore.Transaction memory decodedTx = _depositTx.decode();

        // Check that the first output has the correct balance.
        require(decodedTx.outputs[0].amount == msg.value);

        // Check that the first output has correct currency (ETH).
        require(decodedTx.outputs[0].token == address(0));

        // Perform other checks and create a deposit block.
        _processDeposit(_depositTx, decodedTx);

        emit DepositCreated(decodedTx.outputs[0].owner, decodedTx.outputs[0].token, msg.value);
    }

    /**
     * @dev Deposits approved amount of ERC20 token. Approve must be called first. Note: does not check if token was added.
     * @param _depositTx RLP encoded transaction to act as the deposit.
     */
    function depositFrom(bytes _depositTx)
        public
    {
        // Only allow up to CHILD_BLOCK_INTERVAL deposits per child block.
        require(nextDepositBlock < CHILD_BLOCK_INTERVAL);

        // Decode the transaction.
        PlasmaCore.Transaction memory decodedTx = _depositTx.decode();

        // Warning, check your ERC20 implementation. TransferFrom should return bool
        require(ERC20(decodedTx.outputs[0].token).transferFrom(msg.sender, address(this), decodedTx.outputs[0].amount));

        // Perform other checks and create a deposit block.
        _processDeposit(_depositTx, decodedTx);

        emit DepositCreated(decodedTx.outputs[0].owner, decodedTx.outputs[0].token, decodedTx.outputs[0].amount);
    }

    function _processDeposit(bytes _depositTx, PlasmaCore.Transaction memory decodedTx)
        internal
    {
        // Check that all but first inputs are 0.
        for (uint i = 1; i < 4; i++) {
            require(decodedTx.outputs[i].amount == 0);
        }

        // Calculate the block root.
        bytes32 root = keccak256(_depositTx);
        for (i = 0; i < 16; i++) {
            root = keccak256(abi.encodePacked(root, zeroHashes[i]));
        }

        // Insert the deposit block.
        uint256 blknum = getDepositBlockNumber();
        blocks[blknum] = Block({
            root: root,
                    timestamp: block.timestamp
                    });

        nextDepositBlock++;
    }

    /**
     * @dev Starts a standard withdrawal of a given output. Uses output-age priority.
     * @param _outputId Identifier of the exiting output.
     * @param _outputTx RLP encoded transaction that created the exiting output.
     * @param _outputTxInclusionProof A Merkle proof showing that the transaction was included.
     */
    function startStandardExit(uint192 _outputId, bytes _outputTx, bytes _outputTxInclusionProof)
        public
        payable
        onlyWithValue(standardExitBond)
    {
        // Check that the output transaction actually created the output.
        require(_transactionIncluded(_outputTx, _outputId, _outputTxInclusionProof));

        // Decode the output ID.
        uint256 oindex = _outputId.getOindex();

        // Parse outputTx.
        PlasmaCore.TransactionOutput memory output = _outputTx.getOutput(oindex);

        // Only output owner can start an exit.
        require(msg.sender == output.owner);

        // Make sure this exit is valid.
        require(output.amount > 0);
        require(exits[_outputId].amount == 0);

        // Make sure queue for this token exists.
        require(hasToken(output.token));

        // Determine the exit's priority.
        uint256 exitPriority = _getExitPriority(_outputId);

        // Insert the exit into the queue and update the exit mapping.
        PriorityQueue queue = PriorityQueue(exitsQueues[output.token]);
        queue.insert(exitPriority);
        exits[_outputId] = Exit({
            owner: output.owner,
            token: output.token,
            amount: output.amount
        });

        emit ExitStarted(output.owner, _outputId, output.amount, output.token);
    }

    /**
     * @dev Blocks a standard exit by showing the exiting output was spent.
     * @param _outputId Identifier of the exiting output to challenge.
     * @param _challengeTx RLP encoded transaction that spends the exiting output.
     * @param _inputIndex Which input to the challenging tx corresponds to the exiting output.
     * @param _challengeTxSig Signature from the exiting output owner over the spend.
     */
    function challengeStandardExit(uint192 _outputId, bytes _challengeTx, uint256 _inputIndex, bytes _challengeTxSig)
        public
    {
        // Check that the output is being used as an input to the challenging tx.
        uint256 inputId = _challengeTx.getInputId(_inputIndex);
        require(inputId == _outputId);

        // Check that the challenging tx is signed by the output's owner.
        address owner = exits[_outputId].owner;
        bytes32 txHash = keccak256(_challengeTx);
        require(owner == ECRecovery.recover(txHash, _challengeTxSig));

        // Delete the exit.
        delete exits[_outputId];

        // Send a bond to the challenger.
        msg.sender.transfer(standardExitBond);

        emit ExitBlocked(msg.sender, _outputId);
    }

    /**
     * @dev Starts an exit for an in-flight transaction.
     * @param _inFlightTx RLP encoded in-flight transaction.
     * @param _inputTxs Transactions that created the inputs to the in-flight transaction.
     * @param _inputTxsInclusionProofs Merkle proofs that show the input-creating transactions are valid.
     * @param _inFlightTxSigs Signatures from the owners of each input.
     */
    function startInFlightExit(
        bytes _inFlightTx,
        bytes _inputTxs,
        bytes _inputTxsInclusionProofs,
        bytes _inFlightTxSigs
    )
        public
        payable
        onlyWithValue(inFlightExitBond)
    {
        // Check that no exit for this transaction already exists.
        InFlightExit storage inFlightExit = _getInFlightExit(_inFlightTx);
        require(inFlightExit.exitStartTimestamp == 0);

        // Get information about the outputs.
        uint8 numInputs;
        uint256 outputSum;
        (numInputs, outputSum) = _getOutputInfo(_inFlightTx);

        // Separate the inputs transactions.
        RLP.RLPItem[] memory splitInputTxs = _inputTxs.toRLPItem().toList();

        // Get information about the inputs.
        uint256 inputId;
        uint256 inputSum;
        uint256 mostRecentInput = 0;
        for (uint8 i = 0; i < numInputs; i++) {
            (inFlightExit.inputs[i], inputId) = _getInputInfo(_inFlightTx, splitInputTxs, _inputTxsInclusionProofs, _inFlightTxSigs, i);
            inputSum += inFlightExit.inputs[i].amount;
            mostRecentInput = Math.max(mostRecentInput, inputId);
        }

        // Make sure the sums are valid.
        require(inputSum >= outputSum);

        // Determine when the exit can be processed.
        uint256 exitPriority = _getExitPriority(mostRecentInput, _inFlightTx);

        // Set the left-most bit to 1 to flag that this is an in-flight exit.
        exitPriority = exitPriority.setBit(255);

        // Insert the exit into the queue.
        // TODO: in-flight exits for tokens other than ETH
        _enqueueExit(address(0), exitPriority);

        // Update the exit mapping.
        inFlightExit.exitStartTimestamp = block.timestamp;
        inFlightExit.bondOwner = msg.sender;

        emit InFlightExitStarted(msg.sender, keccak256(_inFlightTx));
    }

    function _enqueueExit(address _token, uint256 _exitPriority)
        private
    {
        PriorityQueue queue = PriorityQueue(exitsQueues[_token]);
        queue.insert(_exitPriority);
    }

    /**
     * @dev Allows a user to piggyback onto an in-flight transaction.
     * @param _inFlightTx RLP encoded in-flight transaction.
     * @param _outputIndex Index of the input/output to piggyback (0-7).
     */
    function piggybackInFlightExit(
        bytes _inFlightTx,
        uint8 _outputIndex
    )
        public
        payable
        onlyWithValue(piggybackBond)
    {
        // Check that the in-flight exit is currently active and in period 1.
        InFlightExit storage inFlightExit = _getInFlightExit(_inFlightTx);
        require(_getExitPeriod(inFlightExit) == 1);

        // Check that the output index is valid.
        require(_outputIndex < 8);

        // Check that we're not piggybacking something that's already been piggybacked or already exited.
        require(!inFlightExit.exitMap.bitSet(_outputIndex) && !inFlightExit.exitMap.bitSet(_outputIndex + 8));

        // Check that the message sender owns the output.
        PlasmaCore.TransactionOutput memory output;
        if (_outputIndex < 4) {
            output = inFlightExit.inputs[_outputIndex];
        } else {
            output = _inFlightTx.getOutput(_outputIndex - 4);

            // Set the output so it can be exited later.
            inFlightExit.outputs[_outputIndex - 4] = output;
        }
        require(output.owner == msg.sender);

        // Set the output as piggybacked.
        inFlightExit.exitMap = inFlightExit.exitMap.setBit(_outputIndex);

        emit InFlightExitPiggybacked(msg.sender, keccak256(_inFlightTx), _outputIndex);
    }


    /**
     * @dev Attempts to prove that an in-flight exit is not canonical.
     * @param _inFlightTx RLP encoded in-flight transaction being exited.
     * @param _inFlightTxInputIndex Index of the double-spent input in the in-flight transaction.
     * @param _competingTx RLP encoded transaction that spent the input.
     * @param _competingTxInputIndex Index of the double-spent input in the competing transaction.
     * @param _competingTxId Position of the competing transaction.
     * @param _competingTxInclusionProof Proof that the competing transaction was included.
     * @param _competingTxSig Signature proving that the owner of the input signed the competitor.
     */
    function challengeInFlightExitNotCanonical(
        bytes _inFlightTx,
        uint8 _inFlightTxInputIndex,
        bytes _competingTx,
        uint8 _competingTxInputIndex,
        uint256 _competingTxId,
        bytes _competingTxInclusionProof,
        bytes _competingTxSig
    )
        public
    {
        // Check that the exit is currently active and in period 1.
        InFlightExit storage inFlightExit = _getInFlightExit(_inFlightTx);
        require(_getExitPeriod(inFlightExit) == 1);

        // Check that the two transactions are not the same.
        require(keccak256(_inFlightTx) != keccak256(_competingTx));

        // Check that the two transactions share an input.
        uint256 inputId = _inFlightTx.getInputId(_inFlightTxInputIndex);
        require(inputId == _competingTx.getInputId(_competingTxInputIndex));

        // Check that the competing transaction is correctly signed.
        PlasmaCore.TransactionOutput memory input = inFlightExit.inputs[_inFlightTxInputIndex];
        require(input.owner == ECRecovery.recover(keccak256(_competingTx), _competingTxSig));

        // Determine the position of the competing transaction.
        uint256 competitorPosition = ~uint256(0);
        if (_competingTxId != 0) {
            // Check that the competing transaction was included in a block.
            require(_transactionIncluded(_competingTx, _competingTxId, _competingTxInclusionProof));
            competitorPosition = _competingTxId;
        }

        // Competitor must first or must be in the chain before the current oldest competitor.
        require(inFlightExit.oldestCompetitor == 0 || inFlightExit.oldestCompetitor > competitorPosition);

        // Set the oldest competitor and new bond owner.
        inFlightExit.oldestCompetitor = competitorPosition;
        inFlightExit.bondOwner = msg.sender;

        // Set a flag so that only the inputs are exitable, unless a response is received.
        inFlightExit.exitStartTimestamp = inFlightExit.exitStartTimestamp.setBit(255);

        emit InFlightExitChallenged(msg.sender, keccak256(_inFlightTx), competitorPosition);
    }

    /**
     * @dev Allows a user to respond to competitors to an in-flight exit by showing the transaction is included.
     * @param _inFlightTx RLP encoded in-flight transaction being exited.
     * @param _inFlightTxId Position of the in-flight transaction in the chain.
     * @param _inFlightTxInclusionProof Proof that the in-flight transaction is included before the competitor.
     */
    function respondToNonCanonicalChallenge(
        bytes _inFlightTx,
        uint256 _inFlightTxId,
        bytes _inFlightTxInclusionProof
    )
        public
    {
        // Check that the exit is currently active and in period 2.
        InFlightExit storage inFlightExit = _getInFlightExit(_inFlightTx);
        require(_getExitPeriod(inFlightExit) == 2);

        // Check that the in-flight transaction was included.
        require(_transactionIncluded(_inFlightTx, _inFlightTxId, _inFlightTxInclusionProof));

        // Check that the in-flight transaction is older than its competitors.
        require(inFlightExit.oldestCompetitor > _inFlightTxId);

        // Fix the oldest competitor and new bond owner.
        inFlightExit.oldestCompetitor = _inFlightTxId;
        inFlightExit.bondOwner = msg.sender;

        // Reset the flag so only the outputs are exitable.
        inFlightExit.exitStartTimestamp = inFlightExit.exitStartTimestamp.clearBit(255);
    }

    /**
     * @dev Removes an input from list of exitable outputs in an in-flight transaction.
     * @param _inFlightTx RLP encoded in-flight transaction being exited.
     * @param _inFlightTxInputIndex Input that's been spent.
     * @param _spendingTx RLP encoded transaction that spends the input.
     * @param _spendingTxInputIndex Which input to the spending transaction spends the input.
     * @param _spendingTxSig Signature that shows the input owner signed the spending transaction.
     */
    function challengeInFlightExitInputSpent(
        bytes _inFlightTx,
        uint8 _inFlightTxInputIndex,
        bytes _spendingTx,
        uint8 _spendingTxInputIndex,
        bytes _spendingTxSig
    )
        public
    {
        // Check that the exit is currently active and in period 2.
        InFlightExit storage inFlightExit = _getInFlightExit(_inFlightTx);
        require(_getExitPeriod(inFlightExit) == 2);

        // Check that the input is piggybacked.
        require(inFlightExit.exitMap.bitSet(_inFlightTxInputIndex));

        // Check that the two transactions are not the same.
        require(keccak256(_inFlightTx) != keccak256(_spendingTx));

        // Check that the two transactions share an input.
        uint256 inputId = _inFlightTx.getInputId(_inFlightTxInputIndex);
        require(inputId == _spendingTx.getInputId(_spendingTxInputIndex));

        // Check that the spending transaction is signed by the input owner.
        PlasmaCore.TransactionOutput memory input = inFlightExit.inputs[_inFlightTxInputIndex];
        require(input.owner == ECRecovery.recover(keccak256(_spendingTx), _spendingTxSig));

        // Remove the input from the piggyback map and pay out the bond.
        inFlightExit.exitMap = inFlightExit.exitMap.clearBit(_inFlightTxInputIndex);
        msg.sender.transfer(piggybackBond);

        emit InFlightExitOutputBlocked(msg.sender, keccak256(_inFlightTx), inputId);
    }

    /**
     * @dev Removes an output from list of exitable outputs in an in-flight transaction.
     * @param _inFlightTx RLP encoded in-flight transaction being exited.
     * @param _inFlightTxOutputId Output that's been spent.
     * @param _inFlightTxInclusionProof Proof that the in-flight transaction was included.
     * @param _spendingTx RLP encoded transaction that spends the input.
     * @param _spendingTxInputIndex Which input to the spending transaction spends the input.
     * @param _spendingTxSig Signature that shows the input owner signed the spending transaction.
     */
    function challengeInFlightExitOutputSpent(
        bytes _inFlightTx,
        uint256 _inFlightTxOutputId,
        bytes _inFlightTxInclusionProof,
        bytes _spendingTx,
        uint256 _spendingTxInputIndex,
        bytes _spendingTxSig
    )
        public
    {
        // Check that the exit is currently active and in period 2.
        InFlightExit storage inFlightExit = _getInFlightExit(_inFlightTx);
        require(_getExitPeriod(inFlightExit) == 2);

        // Check that the output is piggybacked.
        uint8 oindex = _inFlightTxOutputId.getOindex();
        require(inFlightExit.exitMap.bitSet(oindex + 4));

        // Check that the in-flight transaction is included.
        require(_transactionIncluded(_inFlightTx, _inFlightTxOutputId, _inFlightTxInclusionProof));

        // Check that the spending transaction spends the output.
        require(_inFlightTxOutputId == _spendingTx.getInputId(_spendingTxInputIndex));

        // Check that the spending transaction is signed by the input owner.
        PlasmaCore.TransactionOutput memory output = _inFlightTx.getOutput(oindex);
        require(output.owner == ECRecovery.recover(keccak256(_spendingTx), _spendingTxSig));

        // Remove the output from the piggyback map and pay out the bond.
        inFlightExit.exitMap = inFlightExit.exitMap.clearBit(oindex + 4);
        msg.sender.transfer(piggybackBond);

        emit InFlightExitOutputBlocked(msg.sender, keccak256(_inFlightTx), _inFlightTxOutputId);
    }

    /**
     * @dev Processes any exits that have completed the challenge period.
     * @param _token Token type to process.
     * @param _topUtxoPos First exit that should be processed. Set to zero to skip the check.
     * @param _exitsToProcess Maximal number of exits to process.
     */
    function processExits(address _token, uint256 _topUtxoPos, uint256 _exitsToProcess)
        public
    {
        uint192 uniqueId;
        uint64 exitableTimestamp;
        (uniqueId, exitableTimestamp) = getNextExit(_token);
        require(_topUtxoPos == uniqueId || _topUtxoPos == 0);
        Exit memory currentExit = exits[uniqueId];
        PriorityQueue queue = PriorityQueue(exitsQueues[_token]);
        while (exitableTimestamp < block.timestamp && _exitsToProcess > 0) {
            currentExit = exits[uniqueId];

            // Delete the minimum from the queue.
            queue.delMin();

            // Check that the exit can be processed.
            if (exitableTimestamp.clearBit(63) > block.timestamp) {
                return;
            }

            // Check for the in-flight exit flag.
            if (exitableTimestamp.bitSet(63)) {
                _processInFlightExit(inFlightExits[uniqueId]);
            } else {
                _processStandardExit(exits[uniqueId]);
            }

            // Pull the next exit.
            if (queue.currentSize() > 0) {
                (uniqueId, exitableTimestamp) = getNextExit(_token);
                _exitsToProcess = _exitsToProcess.sub(1);
            } else {
                return;
            }
        }
    }

    /**
     * @dev Given an RLP encoded transaction, returns its unique ID.
     * @param _tx RLP encoded transaction.
     * @return _uniqueId A unique identifier.
     */
    function getUniqueId(bytes _tx)
        public
        pure
        returns (uint192)
    {
        // Unique ID is the transaction's hash, shifted right 64 bits.
        return uint192(keccak256(_tx) >> 64);
    }

    /**
     * @dev Checks if queue for particular token was created.
     * @param _token Address of the token.
     */
    function hasToken(address _token)
        view
        public
        returns (bool)
    {
        return exitsQueues[_token] != address(0);
    }

    /**
     * @dev Returns the data associated with an input or output to an in-flight transaction.
     * @param _tx RLP encoded in-flight transaction.
     * @param _outputIndex Index of the output to query.
     * @return A tuple containing the output's owner and amount.
     */
    function getInFlightExitOutput(bytes _tx, uint256 _outputIndex)
        public
        view
        returns (address, uint256)
    {
        InFlightExit memory inFlightExit = _getInFlightExit(_tx);
        PlasmaCore.TransactionOutput memory output;
        if (_outputIndex < 4) {
            output = inFlightExit.inputs[_outputIndex];
        } else {
            output = inFlightExit.outputs[_outputIndex - 4];
        }
        return (output.owner, output.amount);
    }

    /**
     * @dev Calculates the next deposit block.
     * @return Next deposit block number.
     */
    function getDepositBlockNumber()
        public
        view
        returns (uint256)
    {
        return nextChildBlock - CHILD_BLOCK_INTERVAL + nextDepositBlock;
    }

    /**
     * @dev Checks if the left-most bit of an integer is set.
     * @param _value Integer to check.
     * @return True if left-most bit is set. False otherwise.
     */
    function flagSet(uint256 _value)
        public
        pure
        returns (bool)
    {
        return _value.bitSet(255);
    }


    /*
     * Internal functions
     */

    /**
     * @dev Given an output ID, determines when it's exitable, if it were to be exited now.
     * @param _outputId Output identifier.
     * @return uint256 Timestamp after which this output is exitable.
     */
    function _getExitableTimestamp(uint256 _outputId)
        internal
        view
        returns (uint256)
    {
        uint256 blknum = _outputId.getBlknum();
        return Math.max(blocks[blknum].timestamp + (MIN_EXIT_PERIOD * 2), block.timestamp + MIN_EXIT_PERIOD);
    }

    /**
     * @dev Given a output ID and a unique ID, returns an exit priority.
     * @param _outputId Position of the exit in the blockchain.
     * @param _uniqueId Unique exit identifier.
     * @return An exit priority.
     */
    function _getExitPriority(uint256 _outputId, uint192 _uniqueId)
        internal
        view
        returns (uint256)
    {
        return _getExitableTimestamp(_outputId) << 192 | _uniqueId;
    }

    /**
     * @dev Given an output ID, returns an exit priority.
     * @param _outputId Position of the exit in the blockchain.
     * @return An exit priority.
     */
    function _getExitPriority(uint256 _outputId)
        internal
        view
        returns (uint256)
    {
        return _getExitPriority(_outputId, uint192(_outputId));
    }

    /**
     * @dev Given a transaction and the ID for a output in the transaction, returns an exit priority.
     * @param _outputId Identifier of an output in the transaction.
     * @param _tx RLP encoded transaction.
     * @return An exit priority.
     */
    function _getExitPriority(uint256 _outputId, bytes _tx)
        internal
        view
        returns (uint256)
    {
        return _getExitPriority(_outputId, getUniqueId(_tx));
    }

    /**
     * @dev Checks that a given transaction was included in a block and created a specified output.
     * @param _tx RLP encoded transaction to verify.
     * @param _transactionId Unique transaction identifier for the encoded transaction.
     * @param _txInclusionProof Proof that the transaction was in a block.
     * @return True if the transaction was in a block and created the output. False otherwise.
     */
    function _transactionIncluded(bytes _tx, uint256 _transactionId, bytes _txInclusionProof)
        internal
        view
        returns (bool)
    {
        // Decode the transaction ID.
        uint256 blknum = _transactionId.getBlknum();
        uint256 txindex = _transactionId.getTxindex();

        // Check that the transaction was correctly included.
        bytes32 blockRoot = blocks[blknum].root;
        bytes32 leafHash = keccak256(_tx);
        return Merkle.checkMembership(leafHash, txindex, blockRoot, _txInclusionProof);
    }

    /**
     * @dev Returns the in-flight exit for a given in-flight transaction.
     * @param _inFlightTx RLP encoded in-flight transaction.
     * @return An InFlightExit reference.
     */
    function _getInFlightExit(bytes _inFlightTx)
        internal
        view
        returns (InFlightExit storage)
    {
        return inFlightExits[getUniqueId(_inFlightTx)];
    }

    /**
     * @dev Returns the period an exit period is currently in.
     * @param _inFlightExit Exit to check.
     * @return The current period for the specified exit.
     */
    function _getExitPeriod(InFlightExit _inFlightExit)
        internal
        view
        returns (uint256)
    {
        uint256 periodTime = MIN_EXIT_PERIOD / 2;
        return ((block.timestamp - _inFlightExit.exitStartTimestamp.clearBit(255)) / periodTime) + 1;
    }

    /**
     * @dev Returns the next exit to be processed.
     * @return A tuple containing the unique exit ID and timestamp for when the next exit is processable.
     */
    function getNextExit(address _token)
        public
        view
        returns (uint192, uint64)
    {
        PriorityQueue queue = PriorityQueue(exitsQueues[_token]);
        uint256 priority = queue.getMin();
        uint192 uniqueId = uint192(priority);
        uint64 exitableTimestamp = uint64(priority >> 192);
        return (uniqueId, exitableTimestamp);
    }

    /**
     * @dev Returns the number of required inputs and sum of the outputs for a transaction.
     * @param _tx RLP encoded transaction.
     * @return A tuple containing the number of inputs and the sum of the outputs of tx.
     */
    function _getOutputInfo(bytes _tx)
        internal
        view
        returns (uint8, uint256)
    {
        // Loop through each input.
        uint8 numInputs = 0;
        uint256 outputSum = 0;
        PlasmaCore.TransactionOutput memory output;
        PlasmaCore.TransactionOutput[] memory outputs = new PlasmaCore.TransactionOutput[](4);
        for (uint8 i = 0; i < 4; i++) {
            if (_tx.getInputId(i) > 0) {
                numInputs++;
            }

            output = _tx.getOutput(i);
            outputSum += output.amount;
            outputs[i] = output;
        }

        return (numInputs, outputSum);
    }

    /**
     * @dev Returns information about an input to a transaction.
     * @param _tx RLP encoded transaction.
     * @param _txInputTxs RLP encoded transactions that created the inputs to the transaction.
     * @param _txInputTxsInclusionProofs Proofs of inclusion for each input creation transaction.
     * @param _txSigs Signatures that prove the transaction is valid.
     * @param _inputIndex Which input to access.
     * @return A tuple containing information about the inputs.
     */
    function _getInputInfo(
        bytes _tx,
        RLP.RLPItem[] _txInputTxs,
        bytes _txInputTxsInclusionProofs,
        bytes _txSigs,
        uint8 _inputIndex
    )
        internal
        view
        returns (PlasmaCore.TransactionOutput, uint256)
    {
        // Slice off the relevant transaction information.
        bytes memory inputTx = _txInputTxs[_inputIndex].toBytes();
        bytes memory inputTxInclusionProof = _txInputTxsInclusionProofs.sliceProof(_inputIndex);
        bytes memory inputSig = _txSigs.sliceSignature(_inputIndex);

        // Pull information about the the input.
        uint256 inputId = _tx.getInputId(_inputIndex);
        uint256 oindex = inputId.getOindex();
        PlasmaCore.TransactionOutput memory input = inputTx.getOutput(oindex);

        // Check that the transaction is valid.
        require(_transactionIncluded(inputTx, inputId, inputTxInclusionProof));
        require(input.owner == ECRecovery.recover(keccak256(_tx), inputSig));

        return (input, inputId);
    }

    /**
     * @dev Processes a standard exit.
     * @param _standardExit Exit to process.
     */
    function _processStandardExit(Exit storage _standardExit)
        internal
    {
        // If the exit is valid, pay out the exit and refund the bond.
        if (_standardExit.owner != address(0)) {
            if (_standardExit.token == address(0)) {
                _standardExit.owner.transfer(_standardExit.amount + standardExitBond);
            }
            else {
                require(ERC20(_standardExit.token).transfer(_standardExit.owner, _standardExit.amount));
                _standardExit.owner.transfer(standardExitBond);
            }
        }

        // Only delete the owner so someone can't exit from the same output twice.
        delete _standardExit.owner;
        // Delete token too, since check is done by amount anyway.
        delete _standardExit.token;
    }

    /**
     * @dev Processes a in-flight exit.
     * @param _inFlightExit Exit to process.
     */
    function _processInFlightExit(InFlightExit storage _inFlightExit)
        internal
    {
        // Determine whether the inputs or the outputs are the exitable set.
        bool inputsExitable = flagSet(_inFlightExit.exitStartTimestamp);

        // Process the inputs or outputs.
        PlasmaCore.TransactionOutput memory output;
        uint256 transferAmount;
        for (uint8 i = 0; i < 8; i++) {
            // Check if the "to exit" bit is not set or if the "already exited" bit is set.
            if (!_inFlightExit.exitMap.bitSet(i) || _inFlightExit.exitMap.bitSet(i + 8)) {
                continue;
            }
            _inFlightExit.exitMap = _inFlightExit.exitMap.clearBit(i).setBit(i + 8);

            if (i < 4) {
                output = _inFlightExit.inputs[i];
            } else {
                output = _inFlightExit.outputs[i - 4];
            }

            // Pay out any unchallenged and exitable inputs or outputs, refund the rest.
            transferAmount = piggybackBond;
            if ((i < 4 && inputsExitable) || (i >= 4 && !inputsExitable)) {
                transferAmount += output.amount;
            }
            output.owner.transfer(transferAmount);
        }

        // Refund the current bond owner.
        _inFlightExit.bondOwner.transfer(inFlightExitBond);

        // Delete everything but the exitmap to block additional exits.
        delete _inFlightExit.exitStartTimestamp;
        delete _inFlightExit.inputs;
        delete _inFlightExit.outputs;
        delete _inFlightExit.bondOwner;
        delete _inFlightExit.oldestCompetitor;
    }
}
