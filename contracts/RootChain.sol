pragma solidity ^0.4.0;

import "./Bits.sol";
import "./ByteUtils.sol";
import "./ECRecovery.sol";
import "./Math.sol";
import "./Merkle.sol";
import "./RLP.sol";
import "./PlasmaCore.sol";
import "./PriorityQueue.sol";
import "./PriorityQueueFactory.sol";

import "./ERC20.sol";


/**
 * @title RootChain
 * @dev Represents a MoreVP Plasma chain.
 */
contract RootChain {
    using Bits for uint192;
    using Bits for uint256;
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
    uint256 constant public CHILD_BLOCK_INTERVAL = 1000;

    // WARNING: These placeholder bond values are entirely arbitrary.
    uint256 public standardExitBond = 31415926535 wei;
    uint256 public inFlightExitBond = 31415926535 wei;
    uint256 public piggybackBond = 31415926535 wei;

    // NOTE: this is the "middle" period. Exit period for fresh utxos we'll double that while IFE phase is half that
    uint256 public minExitPeriod;

    address public operator;

    uint256 public nextChildBlock;
    uint256 public nextDepositBlock;

    uint256 public nextFeeExit;

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
        uint256 indexed blknum,
        address indexed token,
        uint256 amount
    );

    event ExitStarted(
        address indexed owner,
        uint256 outputId,
        uint256 amount,
        address token
    );

    event ExitFinalized(
        uint256 indexed utxoPos
    );

    event ExitChallenged(
        uint256 indexed utxoPos
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

    event InFlightExitChallengeResponded(
        address challenger,
        bytes32 txHash,
        uint256 challengeTxPosition
    );

    event InFlightExitOutputBlocked(
        address indexed challenger,
        bytes32 txHash,
        uint256 outputId
    );

    event InFlightExitFinalized(
        uint192 inFlightExitId,
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
     * Constructor. Empty because see `function init()`
     */

    constructor()
        public
    {

    }

    /*
     * Public functions
     */

    /**
     * @dev Required to be called before any operations on the contract
     * Split from `constructor` to fit into block gas limit
     * @param _minExitPeriod standard exit period in seconds
     */
    function init(uint256 _minExitPeriod)
        public
    {
      _initOperator();

      minExitPeriod = _minExitPeriod;

      nextChildBlock = CHILD_BLOCK_INTERVAL;
      nextDepositBlock = 1;

      nextFeeExit = 1;

      // Support only ETH on deployment; other tokens need
      // to be added explicitly.
      exitsQueues[address(0)] = PriorityQueueFactory.deploy(this);

      // Pre-compute some hashes to save gas later.
      bytes32 zeroHash = keccak256(abi.encodePacked(uint256(0)));
      for (uint i = 0; i < 16; i++) {
          zeroHashes[i] = zeroHash;
          zeroHash = keccak256(abi.encodePacked(zeroHash, zeroHash));
      }
    }

    // @dev Allows anyone to add new token to Plasma chain
    // @param token The address of the ERC20 token
    function addToken(address _token)
        public
    {
        require(!hasToken(_token));
        exitsQueues[_token] = PriorityQueueFactory.deploy(this);
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

    }

    function _processDeposit(bytes _depositTx, PlasmaCore.Transaction memory decodedTx)
        internal
    {
        // Following check is needed since _processDeposit
        // can be called on stack unwinding during re-entrance attack,
        // with nextDepositBlock == 999, producing
        // deposit with blknum ending with 000.
        require(nextDepositBlock < CHILD_BLOCK_INTERVAL);

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

        emit DepositCreated(
            decodedTx.outputs[0].owner,
            blknum,
            decodedTx.outputs[0].token,
            decodedTx.outputs[0].amount
        );

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
        uint8 oindex = uint8(_outputId.getOindex());

        // Parse outputTx.
        PlasmaCore.TransactionOutput memory output = _outputTx.getOutput(oindex);

        // Only output owner can start an exit.
        require(msg.sender == output.owner);

        uint192 exitId = getStandardExitId(_outputId);

        // Make sure this exit is valid.
        require(output.amount > 0);
        require(exits[exitId].amount == 0);

        // Check if this output was piggybacked or exited in in-flight exit
        InFlightExit storage inFlightExit = _getInFlightExit(_outputTx);
        require(!inFlightExit.exitMap.bitSet(oindex + 4) && !inFlightExit.exitMap.bitSet(oindex + 4 + 8));

        // Make sure queue for this token exists.
        require(hasToken(output.token));

        // Determine the exit's priority.
        uint256 exitPriority = getStandardExitPriority(exitId, _outputId);
        exitPriority = markStandard(exitPriority);

        // Insert the exit into the queue and update the exit mapping.
        PriorityQueue queue = PriorityQueue(exitsQueues[output.token]);
        queue.insert(exitPriority);
        exits[exitId] = Exit({
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

        uint192 exitId = getStandardExitId(_outputId);

        // Check that the challenging tx is signed by the output's owner.
        address owner = exits[exitId].owner;
        bytes32 txHash = keccak256(_challengeTx);
        require(owner == ECRecovery.recover(txHash, _challengeTxSig));

        // Delete the exit.
        delete exits[exitId];

        // Send a bond to the challenger.
        msg.sender.transfer(standardExitBond);

        emit ExitChallenged(_outputId);
    }

    /**
     * @dev Allows the operator withdraw any allotted fees. Starts an exit to avoid theft.
     * @param _token Token to withdraw.
     * @param _amount Amount in fees to withdraw.
     */
    function startFeeExit(address _token, uint256 _amount)
        public
        payable
        onlyOperator
        onlyWithValue(standardExitBond)
    {
        // Make sure queue for this token exists.
        require(hasToken(_token));

        // Make sure this exit is valid.
        require(_amount > 0);

        uint192 exitId = getStandardExitId(nextFeeExit);

        // Determine the exit's priority.
        uint256 exitPriority = getFeeExitPriority(exitId);
        exitPriority = markStandard(exitPriority);

        // Insert the exit into the queue and update the exit mapping.
        PriorityQueue queue = PriorityQueue(exitsQueues[_token]);
        queue.insert(exitPriority);
        exits[exitId] = Exit({
            owner: operator,
            token: _token,
            amount: _amount
        });

        nextFeeExit++;
        emit ExitStarted(operator, exitId, _amount, _token);
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
        // Check if there is an active in-flight exit from this transaction?
        InFlightExit storage inFlightExit = _getInFlightExit(_inFlightTx);
        require(inFlightExit.exitStartTimestamp == 0);

        // Get information about the outputs.
        uint8 numInputs;
        uint256 outputSum;
        // TODO: re-write to support ERC20 tokens
        (numInputs, outputSum) = _getOutputInfo(_inFlightTx);

        // Separate the inputs transactions.
        RLP.RLPItem[] memory splitInputTxs = _inputTxs.toRLPItem().toList();

        // Get information about the inputs.
        uint256 inputId;
        uint256 inputSum;
        uint256 mostRecentInput = 0;
        for (uint8 i = 0; i < numInputs; i++) {
            (inFlightExit.inputs[i], inputId) = _getInputInfo(_inFlightTx, splitInputTxs, _inputTxsInclusionProofs, _inFlightTxSigs, i);
            require(inFlightExit.inputs[i].token == address(0));
            inputSum += inFlightExit.inputs[i].amount;
            mostRecentInput = Math.max(mostRecentInput, inputId);
        }

        // Make sure the sums are valid.
        require(inputSum >= outputSum);

        // Determine when the exit can be processed.
        uint256 exitPriority = getInFlightExitPriority(mostRecentInput, _inFlightTx);
        exitPriority = markInFlight(exitPriority);

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
        inFlightExit.exitStartTimestamp = setFlag(inFlightExit.exitStartTimestamp);

        emit InFlightExitChallenged(msg.sender, keccak256(_inFlightTx), competitorPosition);
    }

    /**
     * @dev Allows a user to respond to competitors to an in-flight exit by showing the transaction is included.
     * @param _inFlightTx RLP encoded in-flight transaction being exited.
     * @param _inFlightTxPos Position of the in-flight transaction in the chain.
     * @param _inFlightTxInclusionProof Proof that the in-flight transaction is included before the competitor.
     */
    function respondToNonCanonicalChallenge(
        bytes _inFlightTx,
        uint256 _inFlightTxPos,
        bytes _inFlightTxInclusionProof
    )
        public
    {
        // Check that the exit is currently active and first two periods.
        InFlightExit storage inFlightExit = _getInFlightExit(_inFlightTx);
        require(_getExitPeriod(inFlightExit) < 3);

        // Check that the in-flight transaction was included.
        require(_transactionIncluded(_inFlightTx, _inFlightTxPos, _inFlightTxInclusionProof));

        // Check that the in-flight transaction is older than its competitors.
        require(inFlightExit.oldestCompetitor > _inFlightTxPos);

        // Fix the oldest competitor and new bond owner.
        inFlightExit.oldestCompetitor = _inFlightTxPos;
        inFlightExit.bondOwner = msg.sender;

        // Reset the flag so only the outputs are exitable.
        inFlightExit.exitStartTimestamp = clearFlag(inFlightExit.exitStartTimestamp);

        emit InFlightExitChallengeResponded(msg.sender, keccak256(_inFlightTx), _inFlightTxPos);

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
        // Check that the exit is currently active and in first two periods.
        InFlightExit storage inFlightExit = _getInFlightExit(_inFlightTx);
        require(_getExitPeriod(inFlightExit) < 3);

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
        // Check that the exit is currently active and in first two periods.
        InFlightExit storage inFlightExit = _getInFlightExit(_inFlightTx);
        require(_getExitPeriod(inFlightExit) < 3);

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
        uint64 exitableTimestamp;
        uint192 exitId;
        bool inFlight;
        uint256 topUtxoExitId = getStandardExitId(_topUtxoPos);
        (exitableTimestamp, exitId, inFlight) = getNextExit(_token);
        require(topUtxoExitId == exitId || topUtxoExitId == 0);
        Exit memory currentExit = exits[exitId];
        PriorityQueue queue = PriorityQueue(exitsQueues[_token]);
        while (exitableTimestamp < block.timestamp && _exitsToProcess > 0) {
            currentExit = exits[exitId];

            // Delete the minimum from the queue.
            queue.delMin();

            // Check that the exit can be processed.
            if (isMature(exitableTimestamp)) {
                return;
            }

            // Check for the in-flight exit flag.
            if (inFlight) {
                // handle ERC20 transfers for InFlight exits
                _processInFlightExit(inFlightExits[exitId], exitId);
                // think of useful event scheme for in-flight outputs finalization
            } else {
                _processStandardExit(exits[exitId]);
                emit ExitFinalized(exitId >> 1);
            }

            // Pull the next exit.
            if (queue.currentSize() > 0) {
                (exitableTimestamp, exitId, inFlight) = getNextExit(_token);
                _exitsToProcess--;
            } else {
                return;
            }
        }
    }

    function isMature(uint64 exitableTimestamp)
        public
        view
        returns (bool)
    {
        // Ignore the value of the flag here.
        return exitableTimestamp > block.timestamp;
    }

    // Set the least significant bit of uniqueId to flag it as in-flight exit.
    function markInFlight(uint256 priority)
        public
        pure
        returns (uint256)
    {
        return priority.setBit(0);
    }

    // Clear the least significant bit of uniqueId to flag it as standard exit.
    function markStandard(uint256 priority)
        public
        pure
        returns (uint256)
    {
        return priority.clearBit(0);
    }

    /**
     * @dev Given an RLP encoded transaction, returns its exit ID.
     * @param _tx RLP encoded transaction.
     * @return _uniqueId A unique identifier of an in-flight exit.
     */
    function getInFlightExitId(bytes _tx)
        public
        pure
        returns (uint192)
    {
        // Exit ID of in-flight transaction is 191 bits of the transaction's hash, padded with zero on the right.
        return uint192(keccak256(_tx) << 1);
    }

    /**
     * @dev Given UTXO's position, returns its exit ID.
     * @param _outputId UTXO position.
     * @return _uniqueId A unique identifier of an standard exit.
     */
    function getStandardExitId(uint256 _outputId)
        public
        pure
        returns (uint192)
    {
        return uint192(_outputId << 1);
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
        returns (address, address, uint256)
    {
        InFlightExit memory inFlightExit = _getInFlightExit(_tx);
        PlasmaCore.TransactionOutput memory output;
        if (_outputIndex < 4) {
            output = inFlightExit.inputs[_outputIndex];
        } else {
            output = inFlightExit.outputs[_outputIndex - 4];
        }
        return (output.owner, output.token, output.amount);
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
    function flagged(uint256 _value)
        public
        pure
        returns (bool)
    {
        return _value.bitSet(255);
    }

    function setFlag(uint256 _value)
        public
        pure
        returns (uint256)
    {
        return _value.setBit(255);
    }

    function clearFlag(uint256 _value)
        public
        pure
        returns (uint256)
    {
        return _value.clearBit(255);
    }

    /*
     * Internal functions
     */

    /**
     * @dev Given an output ID, determines when it's exitable, if it were to be exited now.
     * @param _outputId Output identifier.
     * @return uint256 Timestamp after which this output is exitable.
     */
    function getExitableTimestamp(uint256 _outputId)
        public
        view
        returns (uint256)
    {
        uint256 blknum = _outputId.getBlknum();
        if (blknum % CHILD_BLOCK_INTERVAL == 0) {
            return Math.max(blocks[blknum].timestamp + (minExitPeriod * 2), block.timestamp + minExitPeriod);
        }
        else {
            // High priority exit for the deposit.
            return block.timestamp + minExitPeriod;
        }
    }

    /**
     * @dev Given a fee exit ID returns an exit priority.
     * @param _feeExitId Fee exit identifier.
     * @return An exit priority.
     */
    function getFeeExitPriority(uint256 _feeExitId)
        public
        view
        returns (uint256)
    {
        return ((block.timestamp + (2 * minExitPeriod)) << 192) | _feeExitId;
    }


    /**
     * @dev Given a output ID and a unique ID, returns an exit priority.
     * @param _exitId Unique exit identifier.
     * @param _outputId Position of the exit in the blockchain.
     * @return An exit priority.
     */
    function getStandardExitPriority(uint192 _exitId, uint256 _outputId)
        public
        view
        returns (uint256)
    {
        return (getExitableTimestamp(_outputId) << 192) | _exitId;
    }

    /**
     * @dev Given a transaction and the ID for a output in the transaction, returns an exit priority.
     * @param _outputId Identifier of an output in the transaction.
     * @param _tx RLP encoded transaction.
     * @return An exit priority.
     */
    function getInFlightExitPriority(uint256 _outputId, bytes _tx)
        view
        returns (uint256)
    {
        return getStandardExitPriority(getInFlightExitId(_tx), _outputId);
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
        return inFlightExits[getInFlightExitId(_inFlightTx)];
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
        uint256 periodTime = minExitPeriod / 2;
        return ((block.timestamp - clearFlag(_inFlightExit.exitStartTimestamp)) / periodTime) + 1;
    }

    /**
     * @dev Returns the next exit to be processed.
     * @return A tuple with timestamp for when the next exit is processable, its unique exit id
               and flag determining if exit is in-flight one.
     */
    function getNextExit(address _token)
        public
        view
        returns (uint64, uint192, bool)
    {
        PriorityQueue queue = PriorityQueue(exitsQueues[_token]);
        uint256 priority = queue.getMin();
        uint64 exitableTimestamp = uint64(priority >> 192);
        uint192 exitId = uint192(priority.clearBit(0));
        bool inFlight = priority.getBit(0) == 1;
        return (exitableTimestamp, exitId, inFlight);
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
     * @param _inFlightExitId Id of the exit process
     */
    function _processInFlightExit(InFlightExit storage _inFlightExit, uint192 _inFlightExitId)
        internal
    {
        // Determine whether the inputs or the outputs are the exitable set.
        bool inputsExitable = flagged(_inFlightExit.exitStartTimestamp);

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
                emit InFlightExitFinalized(_inFlightExitId, i);
            }
            output.owner.transfer(transferAmount);
        }

        // Refund the current bond owner.
        _inFlightExit.bondOwner.transfer(inFlightExitBond);

        // Delete everything but the exitmap to block exits from already processed outputs.
        delete _inFlightExit.exitStartTimestamp;
        delete _inFlightExit.inputs;
        delete _inFlightExit.outputs;
        delete _inFlightExit.bondOwner;
        delete _inFlightExit.oldestCompetitor;
    }

    /**
     * @dev Can be called only once in `init`.
     */
    function _initOperator()
    {
      require(operator == address(0));
      operator = msg.sender;
    }
}
