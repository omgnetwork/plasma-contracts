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

    // Applies to outputs too
    uint8 constant public MAX_INPUTS = 4;

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
        uint192 position;
    }

    struct InFlightExit {
        uint256 exitStartTimestamp;
        uint256 exitPriority;
        uint256 exitMap;
        PlasmaCore.TransactionOutput[MAX_INPUTS] inputs;
        PlasmaCore.TransactionOutput[MAX_INPUTS] outputs;
        address bondOwner;
        uint256 oldestCompetitor;
    }

    struct _InputSum {
        address token;
        uint256 amount;
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
        uint192 exitId
    );

    event ExitFinalized(
        uint192 indexed exitId
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
        uint8 outputIndex
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
        uint8 outputIndex
    );

    event InFlightExitFinalized(
        uint192 inFlightExitId,
        uint8 outputIndex
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
     * Empty, check `function init()`
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
        emit TokenAdded(_token);
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
        for (uint i = 1; i < MAX_INPUTS; i++) {
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
            Crosschecks in-flight exit existence.
            NOTE: requires the exiting UTXO's token to be added via `addToken`
     * @param _utxoPos Position of the exiting output.
     * @param _outputTx RLP encoded transaction that created the exiting output.
     * @param _outputTxInclusionProof A Merkle proof showing that the transaction was included.
     */
    function startStandardExit(uint192 _utxoPos, bytes _outputTx, bytes _outputTxInclusionProof)
        public
        payable
        onlyWithValue(standardExitBond)
    {
        // Check that the output transaction actually created the output.
        require(_transactionIncluded(_outputTx, _utxoPos, _outputTxInclusionProof));

        // Decode the output ID.
        uint8 oindex = uint8(_utxoPos.getOindex());

        // Parse outputTx.
        PlasmaCore.TransactionOutput memory output = _outputTx.getOutput(oindex);

        // Only output owner can start an exit.
        require(msg.sender == output.owner);

        uint192 exitId = getStandardExitId(_outputTx, _utxoPos);

        // Make sure this exit is valid.
        require(output.amount > 0);
        require(exits[exitId].amount == 0);

        InFlightExit storage inFlightExit = _getInFlightExit(_outputTx);
        // Check whether IFE is either ongoing or finished
        if (inFlightExit.exitStartTimestamp != 0 || isFinalized(inFlightExit)) {
            // Check if this output was piggybacked or exited in an in-flight exit
            require(!isPiggybacked(inFlightExit, oindex + MAX_INPUTS) && !isExited(inFlightExit, oindex + MAX_INPUTS));
            // Prevent future piggybacks on this output
            setExited(inFlightExit, oindex + MAX_INPUTS);
        }

        // Determine the exit's priority.
        uint256 exitPriority = getStandardExitPriority(exitId, _utxoPos);

        // Enqueue the exit into the queue and update the exit mapping.
        _enqueueExit(output.token, exitPriority);
        exits[exitId] = Exit({
            owner: output.owner,
            token: output.token,
            amount: output.amount,
            position: _utxoPos
        });

        emit ExitStarted(output.owner, exitId);
    }

    /**
     * @dev Blocks a standard exit by showing the exiting output was spent.
     * @param _standardExitId Identifier of the standard exit to challenge.
     * @param _challengeTx RLP encoded transaction that spends the exiting output.
     * @param _inputIndex Which input of the challenging tx corresponds to the exiting output.
     * @param _challengeTxSig Signature from the exiting output owner over the spend.
     */
    function challengeStandardExit(uint192 _standardExitId, bytes _challengeTx, uint8 _inputIndex, bytes _challengeTxSig)
        public
    {
        // Check that the output is being used as an input to the challenging tx.
        uint256 challengedUtxoPos = _challengeTx.getInputUtxoPosition(_inputIndex);
        require(challengedUtxoPos == exits[_standardExitId].position);

        // Check if exit exists.
        address owner = exits[_standardExitId].owner;
        // Check that the challenging tx is signed by the output's owner.
        bytes32 txHash = keccak256(_challengeTx);
        require(owner == ECRecovery.recover(txHash, _challengeTxSig));

        _processChallengeStandardExit(challengedUtxoPos, _standardExitId);
    }

    function _cleanupDoubleSpendingStandardExits(uint256 _utxoPos, bytes _txbytes)
        internal
        returns (bool)
    {
        uint192 standardExitId = getStandardExitId(_txbytes, _utxoPos);
        if (exits[standardExitId].owner != address(0)) {
            _processChallengeStandardExit(_utxoPos, standardExitId);
            return false;
        }
        return exits[standardExitId].amount != 0;
    }

    function _processChallengeStandardExit(uint256 _utxoPos, uint192 _exitId)
        internal
    {
        // Delete the exit.
        delete exits[_exitId];

        // Send a bond to the challenger.
        msg.sender.transfer(standardExitBond);

        emit ExitChallenged(_utxoPos);
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

        uint192 exitId = getFeeExitId(nextFeeExit);

        // Determine the exit's priority.
        uint256 exitPriority = getFeeExitPriority(exitId);

        // Insert the exit into the queue and update the exit mapping.
        PriorityQueue queue = PriorityQueue(exitsQueues[_token]);
        queue.insert(exitPriority);
        exits[exitId] = Exit({
            owner: operator,
            token: _token,
            amount: _amount,
            position: uint192(nextFeeExit)
        });

        nextFeeExit++;
        emit ExitStarted(operator, exitId);
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

        // Check if such an in-flight exit has already been finalized
        require(!isFinalized(inFlightExit));

        // Separate the inputs transactions.
        RLP.RLPItem[] memory splitInputTxs = _inputTxs.toRLPItem().toList();
        uint256 [] memory inputTxoPos = new uint256[](splitInputTxs.length);

        uint256 youngestInputTxoPos;
        bool finalized;
        bool any_finalized = false;
        for (uint8 i = 0; i < MAX_INPUTS; i++) {
            if (_inFlightTx.getInputUtxoPosition(i) == 0) break;


            (inFlightExit.inputs[i], inputTxoPos[i], finalized) = _getInputInfo(
                _inFlightTx, splitInputTxs[i].toBytes(), _inputTxsInclusionProofs, _inFlightTxSigs.sliceSignature(i), i
            );

            youngestInputTxoPos = Math.max(youngestInputTxoPos, inputTxoPos[i]);
            any_finalized = any_finalized || finalized;

            // check whether IFE spends one UTXO twice
            for (uint8 j = 0; j < i; ++j){
                require(inputTxoPos[i] != inputTxoPos[j]);
            }
        }

        // Validate sums of inputs against sum of outputs token-wise
        _validateInputsOutputsSumUp(inFlightExit, _inFlightTx);

        // Update the exit mapping.
        inFlightExit.bondOwner = msg.sender;
        inFlightExit.exitStartTimestamp = block.timestamp;
        inFlightExit.exitPriority = getInFlightExitPriority(_inFlightTx, youngestInputTxoPos);

        // If any of the inputs were finalized via standard exit, consider it non-canonical
        // and flag as not taking part in further canonicity game.
        if (any_finalized) {
            setNonCanonical(inFlightExit);
        }

        emit InFlightExitStarted(msg.sender, keccak256(_inFlightTx));
    }

    function _enqueueExit(address _token, uint256 _exitPriority)
        private
    {
        // Make sure queue for this token exists.
        require(hasToken(_token));

        PriorityQueue queue = PriorityQueue(exitsQueues[_token]);
        queue.insert(_exitPriority);
    }

    /**
     * @dev Allows a user to piggyback onto an in-flight transaction.
            NOTE: requires the exiting UTXO's token to be added via `addToken`
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
        bytes32 txhash = keccak256(_inFlightTx);

        // Check that the output index is valid.
        require(_outputIndex < 8);

        // Check if SE from the output is not started nor finalized
        if (_outputIndex >= MAX_INPUTS) {
            // Note that we cannot in-flight exit from a deposit, therefore here the output of the transaction
            // cannot be an output of deposit, so we do not have to use `getStandardExitId` (we actually cannot
            // as an output of IFE does not have utxoPos)
            require(exits[_computeStandardExitId(txhash, _outputIndex - MAX_INPUTS)].amount == 0);
        }

        // Check that the in-flight exit is active and in period 1.
        InFlightExit storage inFlightExit = _getInFlightExit(_inFlightTx);
        require(_firstPhaseNotOver(inFlightExit));


        // Check that we're not piggybacking something that's already been piggybacked.
        require(!isPiggybacked(inFlightExit, _outputIndex));

        // Check that the message sender owns the output.
        PlasmaCore.TransactionOutput memory output;
        if (_outputIndex < MAX_INPUTS) {
            output = inFlightExit.inputs[_outputIndex];
        } else {
            output = _inFlightTx.getOutput(_outputIndex - MAX_INPUTS);

            // Set the output so it can be exited later.
            inFlightExit.outputs[_outputIndex - MAX_INPUTS] = output;
        }
        require(output.owner == msg.sender);

        // Enqueue the exit in a right queue, if not already enqueued.
        if (_shouldEnqueueInFlightExit(inFlightExit, output.token)) {
            _enqueueExit(output.token, inFlightExit.exitPriority);
        }

        // Set the output as piggybacked.
        setPiggybacked(inFlightExit, _outputIndex);

        emit InFlightExitPiggybacked(msg.sender, txhash, _outputIndex);
    }

    function _shouldEnqueueInFlightExit(InFlightExit storage _inFlightExit, address _token)
        internal
        view
        returns (bool)
    {
        for (uint8 i = 0; i < MAX_INPUTS; ++i) {
            if (
                (isPiggybacked(_inFlightExit, i) && _inFlightExit.inputs[i].token == _token)
                ||
                (isPiggybacked(_inFlightExit, i + MAX_INPUTS) && _inFlightExit.outputs[i].token == _token)
            ) {
                return false;
            }
        }

        return true;
    }

    /**
     * @dev Attempts to prove that an in-flight exit is not canonical.
     * @param _inFlightTx RLP encoded in-flight transaction being exited.
     * @param _inFlightTxInputIndex Index of the double-spent input in the in-flight transaction.
     * @param _competingTx RLP encoded transaction that spent the input.
     * @param _competingTxInputIndex Index of the double-spent input in the competing transaction.
     * @param _competingTxPos Position of the competing transaction.
     * @param _competingTxInclusionProof Proof that the competing transaction was included.
     * @param _competingTxSig Signature proving that the owner of the input signed the competitor.
     */
    function challengeInFlightExitNotCanonical(
        bytes _inFlightTx,
        uint8 _inFlightTxInputIndex,
        bytes _competingTx,
        uint8 _competingTxInputIndex,
        uint256 _competingTxPos,
        bytes _competingTxInclusionProof,
        bytes _competingTxSig
    )
        public
    {
        // Check that the exit is active and in period 1.
        InFlightExit storage inFlightExit = _getInFlightExit(_inFlightTx);
        require(_firstPhaseNotOver(inFlightExit));

        // Check if exit's input was spent via MVP exit
        require(!isInputSpent(inFlightExit));

        // Check that the two transactions are not the same.
        require(keccak256(_inFlightTx) != keccak256(_competingTx));

        // Check that the two transactions share an input.
        uint256 inFlightTxInputPos = _inFlightTx.getInputUtxoPosition(_inFlightTxInputIndex);
        require(inFlightTxInputPos == _competingTx.getInputUtxoPosition(_competingTxInputIndex));

        // Check that the competing transaction is correctly signed.
        PlasmaCore.TransactionOutput memory input = inFlightExit.inputs[_inFlightTxInputIndex];
        require(input.owner == ECRecovery.recover(keccak256(_competingTx), _competingTxSig));

        // Determine the position of the competing transaction.
        uint256 competitorPosition = ~uint256(0);
        if (_competingTxPos != 0) {
            // Check that the competing transaction was included in a block.
            require(_transactionIncluded(_competingTx, _competingTxPos, _competingTxInclusionProof));
            competitorPosition = _competingTxPos;
        }

        // Competitor must be first or must be older than the current oldest competitor.
        require(inFlightExit.oldestCompetitor == 0 || inFlightExit.oldestCompetitor > competitorPosition);

        // Set the oldest competitor and new bond owner.
        inFlightExit.oldestCompetitor = competitorPosition;
        inFlightExit.bondOwner = msg.sender;

        // Set a flag so that only the inputs are exitable, unless a response is received.
        setNonCanonicalChallenge(inFlightExit);

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
        InFlightExit storage inFlightExit = _getInFlightExit(_inFlightTx);

        // Check that there is a challenge and in-flight transaction is older than its competitors.
        require(inFlightExit.oldestCompetitor > _inFlightTxPos);

        // Check that the in-flight transaction was included.
        require(_transactionIncluded(_inFlightTx, _inFlightTxPos, _inFlightTxInclusionProof));

        // Fix the oldest competitor and new bond owner.
        inFlightExit.oldestCompetitor = _inFlightTxPos;
        inFlightExit.bondOwner = msg.sender;

        // Reset the flag so only the outputs are exitable.
        setCanonical(inFlightExit);

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
        InFlightExit storage inFlightExit = _getInFlightExit(_inFlightTx);

        // Check that the input is piggybacked.
        require(isPiggybacked(inFlightExit, _inFlightTxInputIndex));

        // Check that the two transactions are not the same.
        require(keccak256(_inFlightTx) != keccak256(_spendingTx));

        // Check that the two transactions share an input.
        uint256 inFlightTxInputPos = _inFlightTx.getInputUtxoPosition(_inFlightTxInputIndex);
        require(inFlightTxInputPos == _spendingTx.getInputUtxoPosition(_spendingTxInputIndex));

        // Check that the spending transaction is signed by the input owner.
        PlasmaCore.TransactionOutput memory input = inFlightExit.inputs[_inFlightTxInputIndex];
        require(input.owner == ECRecovery.recover(keccak256(_spendingTx), _spendingTxSig));

        // Remove the input from the piggyback map and pay out the bond.
        setExitCancelled(inFlightExit, _inFlightTxInputIndex);
        msg.sender.transfer(piggybackBond);

        emit InFlightExitOutputBlocked(msg.sender, keccak256(_inFlightTx), _inFlightTxInputIndex);
    }

    /**
     * @dev Removes an output from list of exitable outputs in an in-flight transaction.
     * @param _inFlightTx RLP encoded in-flight transaction being exited.
     * @param _inFlightTxOutputPos Output that's been spent.
     * @param _inFlightTxInclusionProof Proof that the in-flight transaction was included.
     * @param _spendingTx RLP encoded transaction that spends the input.
     * @param _spendingTxInputIndex Which input to the spending transaction spends the input.
     * @param _spendingTxSig Signature that shows the input owner signed the spending transaction.
     */
    function challengeInFlightExitOutputSpent(
        bytes _inFlightTx,
        uint256 _inFlightTxOutputPos,
        bytes _inFlightTxInclusionProof,
        bytes _spendingTx,
        uint8 _spendingTxInputIndex,
        bytes _spendingTxSig
    )
        public
    {
        InFlightExit storage inFlightExit = _getInFlightExit(_inFlightTx);

        // Check that the output is piggybacked.
        uint8 oindex = _inFlightTxOutputPos.getOindex();
        require(isPiggybacked(inFlightExit, oindex + MAX_INPUTS));

        // Check that the in-flight transaction is included.
        require(_transactionIncluded(_inFlightTx, _inFlightTxOutputPos, _inFlightTxInclusionProof));

        // Check that the spending transaction spends the output.
        require(_inFlightTxOutputPos == _spendingTx.getInputUtxoPosition(_spendingTxInputIndex));

        // Check that the spending transaction is signed by the input owner.
        PlasmaCore.TransactionOutput memory output = _inFlightTx.getOutput(oindex);
        require(output.owner == ECRecovery.recover(keccak256(_spendingTx), _spendingTxSig));

        // Remove the output from the piggyback map and pay out the bond.
        setExitCancelled(inFlightExit, oindex + MAX_INPUTS);
        msg.sender.transfer(piggybackBond);

        emit InFlightExitOutputBlocked(msg.sender, keccak256(_inFlightTx), oindex);
    }

    /**
     * @dev Processes any exits that have completed the challenge period.
     * @param _token Token type to process.
     * @param _topExitId First exit that should be processed. Set to zero to skip the check.
     * @param _exitsToProcess Maximal number of exits to process.
     */
    function processExits(address _token, uint192 _topExitId, uint256 _exitsToProcess)
        public
    {
        uint64 exitableTimestamp;
        uint192 exitId;
        bool inFlight;

        (exitableTimestamp, exitId, inFlight) = getNextExit(_token);
        require(_topExitId == exitId || _topExitId == 0);
        PriorityQueue queue = PriorityQueue(exitsQueues[_token]);

        while (exitableTimestamp < block.timestamp && _exitsToProcess > 0) {
            // Delete the minimum from the queue.
            queue.delMin();

            // Check for the in-flight exit flag.
            if (inFlight) {
                // handle ERC20 transfers for InFlight exits
                _processInFlightExit(inFlightExits[exitId], exitId, _token);
                // think of useful event scheme for in-flight outputs finalization
            } else {
                _processStandardExit(exits[exitId], exitId);
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

    /**
     * @dev Given an RLP encoded transaction, returns its exit ID.
     * @param _tx RLP encoded transaction.
     * @return _uniqueId A unique identifier of an in-flight exit.
     *     Anatomy of returned value, most significant bits first:
     *     8 bits - set to zero
     *     1 bit - in-flight flag
     *     151 bit - tx hash
     */
    function getInFlightExitId(bytes _tx)
        public
        pure
        returns (uint192)
    {
        return uint192((uint256(keccak256(_tx)) >> 151).setBit(152));
    }

    /**
     * @dev Given transaction bytes and UTXO position, returns its exit ID.
     * @notice Id from a deposit is computed differently from any other tx.
     * @param _txbytes Transaction bytes.
     * @param _utxoPos UTXO position of the exiting output.
     * @return _standardExitId Unique standard exit id.
     *     Anatomy of returned value, most significant bits first:
     *     8 bits - oindex
     *     1 bit - in-flight flag
     *     151 bit - tx hash
     */

    function getStandardExitId(bytes memory _txbytes, uint256 _utxoPos)
        public
        view
        returns (uint192)
    {
        bytes memory toBeHashed = _txbytes;

        // Only deposit can have empty first input
        uint256 inputUtxoPos = _txbytes.getInputUtxoPosition(0);
        if (_isDeposit(_utxoPos.getBlknum())){
            toBeHashed = abi.encodePacked(_txbytes, _utxoPos);
        }

        return _computeStandardExitId(keccak256(toBeHashed), _utxoPos.getOindex());
    }

    function getFeeExitId(uint256 feeExitNum)
        public
        pure
        returns (uint192)
    {
        return _computeStandardExitId(keccak256(feeExitNum), 0);
    }

    function _computeStandardExitId(bytes32 _txhash, uint8 _oindex)
        internal
        pure
        returns (uint192)
    {
        return uint192((uint256(_txhash) >> 105) | (uint256(_oindex) << 152));
    }

    /**
     * @dev Returns the next exit to be processed
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
        return unpackExitId(priority);
    }

    function unpackExitId(uint256 priority)
        public
        pure
        returns (uint64, uint192, bool)
    {
        uint64 exitableTimestamp = uint64(priority >> 214);
        bool inFlight = priority.getBit(152) == 1;

        // get 160 least significant bits
        uint192 exitId = uint192((priority << 96) >> 96);

        return (exitableTimestamp, exitId, inFlight);
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
        if (_outputIndex < MAX_INPUTS) {
            output = inFlightExit.inputs[_outputIndex];
        } else {
            output = inFlightExit.outputs[_outputIndex - MAX_INPUTS];
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

    function flagged(uint256 _value)
        public
        pure
        returns (bool)
    {
        return _value.bitSet(255) || _value.bitSet(254);
    }

     /*
     * Internal functions
     */

    function getInFlightExitTimestamp(InFlightExit storage _ife)
        private
        view
        returns (uint256)
    {
        return _ife.exitStartTimestamp.clearBit(255);
    }

    function isPiggybacked(InFlightExit storage _ife, uint8 _output)
        view
        private
        returns (bool)
    {
        return _ife.exitMap.bitSet(_output);
    }

    function isExited(InFlightExit storage _ife, uint8 _output)
        view
        private
        returns (bool)
    {
        return _ife.exitMap.bitSet(_output + MAX_INPUTS * 2);
    }

    function isInputSpent(InFlightExit storage _ife)
        view
        private
        returns (bool)
    {
        return _ife.exitStartTimestamp.bitSet(254);
    }

    function setPiggybacked(InFlightExit storage _ife, uint8 _output)
        private
    {
        _ife.exitMap = _ife.exitMap.setBit(_output);
    }

    function setExited(InFlightExit storage _ife, uint8 _output)
        private
    {
        _ife.exitMap = _ife.exitMap.clearBit(_output).setBit(_output + 2 * MAX_INPUTS);
    }

    function setNonCanonical(InFlightExit storage _ife)
        private
    {
        _ife.exitStartTimestamp = _ife.exitStartTimestamp.setBit(254);
    }

    function setFinalized(InFlightExit storage _ife)
        private
    {
        _ife.exitMap = _ife.exitMap.setBit(255);
    }

    function setNonCanonicalChallenge(InFlightExit storage _ife)
        private
    {
        _ife.exitStartTimestamp = _ife.exitStartTimestamp.setBit(255);
    }

    function setCanonical(InFlightExit storage _ife)
        private
    {
        _ife.exitStartTimestamp = _ife.exitStartTimestamp.clearBit(255);
    }

    function setExitCancelled(InFlightExit storage _ife, uint8 _output)
        private
    {
        _ife.exitMap = _ife.exitMap.clearBit(_output);
    }

    function isInputExit(InFlightExit storage _ife)
        view
        private
        returns (bool)
    {
        return _ife.exitStartTimestamp.bitSet(255) || _ife.exitStartTimestamp.bitSet(254);
    }

    function isFinalized(InFlightExit storage _ife)
        view
        private
        returns (bool)
    {
        return _ife.exitMap.bitSet(255);
    }

    /**
     * @dev Given an utxo position, determines when it's exitable, if it were to be exited now.
     * @param _utxoPos Output identifier.
     * @return uint256 Timestamp after which this output is exitable.
     */
    function getExitableTimestamp(uint256 _utxoPos)
        public
        view
        returns (uint256)
    {
        uint256 blknum = _utxoPos.getBlknum();
        if (_isDeposit(blknum)) {
            // High priority exit for the deposit.
            return block.timestamp + minExitPeriod;
        }
        else {
            return Math.max(blocks[blknum].timestamp + (minExitPeriod * 2), block.timestamp + minExitPeriod);
        }
    }

    /**
     * @dev Given a fee exit ID returns an exit priority.
     * @param _feeExitId Fee exit identifier.
     * @return An exit priority.
     */
    function getFeeExitPriority(uint192 _feeExitId)
        public
        view
        returns (uint256)
    {
        return (uint256(block.timestamp + (minExitPeriod * 2)) << 214) | uint256(_feeExitId);
    }


    /**
     * @dev Given a utxo position and a unique ID, returns an exit priority.
     * @param _exitId Unique exit identifier.
     * @param _utxoPos Position of the exit in the blockchain.
     * @return An exit priority.
     *   Anatomy of returned value, most significant bits first
     *   42 bits - timestamp (exitable_at); unix timestamp fits into 32 bits
     *   54 bits - blknum * 10^9 + txindex; to represent all utxo for 10 years we need only 54 bits
     *   8 bits - oindex; set to zero for in-flight tx
     *   1 bit - in-flight flag
     *   151 bit - tx hash
     */
    function getStandardExitPriority(uint192 _exitId, uint256 _utxoPos)
        public
        view
        returns (uint256)
    {
        uint256 tx_pos = _utxoPos.getTxPos();
        return ((getExitableTimestamp(_utxoPos) << 214) | (tx_pos << 160)) | _exitId;
    }

    /**
     * @dev Given a transaction and the ID for a output in the transaction, returns an exit priority.
     * @param _txoPos Identifier of an output in the transaction.
     * @param _tx RLP encoded transaction.
     * @return An exit priority.
     */
    function getInFlightExitPriority(bytes _tx, uint256 _txoPos)
        view
        returns (uint256)
    {
        return getStandardExitPriority(getInFlightExitId(_tx), _txoPos);
    }

    /**
     * @dev Checks that a given transaction was included in a block and created a specified output.
     * @param _tx RLP encoded transaction to verify.
     * @param _transactionPos Transaction position for the encoded transaction.
     * @param _txInclusionProof Proof that the transaction was in a block.
     * @return True if the transaction was in a block and created the output. False otherwise.
     */
    function _transactionIncluded(bytes _tx, uint256 _transactionPos, bytes _txInclusionProof)
        internal
        view
        returns (bool)
    {
        // Decode the transaction ID.
        uint256 blknum = _transactionPos.getBlknum();
        uint256 txindex = _transactionPos.getTxIndex();

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
     * @dev Checks that in-flight exit is in phase that allows for piggybacks and canonicity challenges.
     * @param _inFlightExit Exit to check.
     * @return True only if in-flight exit is in phase that allows for piggybacks and canonicity challenges.
     */
    function _firstPhaseNotOver(InFlightExit storage _inFlightExit)
        internal
        view
        returns (bool)
    {
        uint256 periodTime = minExitPeriod / 2;
        return ((block.timestamp - getInFlightExitTimestamp(_inFlightExit)) / periodTime) < 1;
    }

    /**
     * @dev Returns the number of required inputs and sum of the outputs for a transaction.
     * @param _tx RLP encoded transaction.
     * @return A tuple containing the number of inputs and the sum of the outputs of tx.
     */
    function _validateInputsOutputsSumUp(InFlightExit storage _inFlightExit, bytes _tx)
        internal
        view
    {
        _InputSum[MAX_INPUTS] memory sums;
        uint8 allocatedSums = 0;

        _InputSum memory tokenSum;
        uint8 i;

        // Loop through each input
        for (i = 0; i < MAX_INPUTS; ++i) {
            PlasmaCore.TransactionOutput memory input = _inFlightExit.inputs[i];

            // Add current input amount to the overall transaction sum (token-wise)
            (tokenSum, allocatedSums) = _getInputSumByToken(sums, allocatedSums, input.token);
            tokenSum.amount += input.amount;
        }

        // Loop through each output
        for (i = 0; i < MAX_INPUTS; ++i) {
            PlasmaCore.TransactionOutput memory output = _tx.getOutput(i);
            (tokenSum, allocatedSums) = _getInputSumByToken(sums, allocatedSums, output.token);

            // Underflow protection
            require(tokenSum.amount >= output.amount);
            tokenSum.amount -= output.amount;
        }

    }

    /**
     * @dev Returns element of an array where sum of the given token is stored.
     * @param _sums array of sums by tokens
     * @param _allocated Number of currently allocated elements in _sums array
     * @param _token Token address which sum is being searched for
     * @return A tuple containing element of array and an updated number of currently allocated elements
     */
    function _getInputSumByToken(_InputSum[MAX_INPUTS] memory _sums, uint8 _allocated, address _token)
        internal
        pure
        returns (_InputSum, uint8)
    {
        // Find token sum within already used ones
        for (uint8 i = 0; i < _allocated; ++i) {

            if (_sums[i].token == _token) {
                return (_sums[i], _allocated);
            }
        }

        // Check whether trying to allocate new token sum, even though all has been used
        // Notice: that there will never be more tokens than number of inputs,
        // as outputs must be of the same tokens as inputs
        require(_allocated < MAX_INPUTS);

        // Allocate new token sum
        _sums[_allocated].token = _token;
        return (_sums[_allocated], _allocated + 1);
    }

    /**
     * @dev Returns information about an input to a in-flight transaction.
     * @param _tx RLP encoded transaction.
     * @param _inputTx RLP encoded transaction that created particular input to this transaction.
     * @param _txInputTxsInclusionProofs Proofs of inclusion for each input creation transaction.
     * @param _inputSig Signature for spent output of the input transaction.
     * @param _inputIndex Which input to access.
     * @return A tuple containing information about the inputs.
     */
    function _getInputInfo(
        bytes _tx,
        bytes memory _inputTx,
        bytes _txInputTxsInclusionProofs,
        bytes _inputSig,
        uint8 _inputIndex
    )
        internal
        view
        returns (PlasmaCore.TransactionOutput, uint256, bool)
    {
        bool already_finalized;

        // Pull information about the the input.
        uint256 inputUtxoPos = _tx.getInputUtxoPosition(_inputIndex);
        PlasmaCore.TransactionOutput memory input = _inputTx.getOutput(inputUtxoPos.getOindex());

        // Check that the transaction is valid.
        require(_transactionIncluded(_inputTx, inputUtxoPos, _txInputTxsInclusionProofs.sliceProof(_inputIndex)));
        require(input.owner == ECRecovery.recover(keccak256(_tx), _inputSig));

        // Challenge exiting standard exits from inputs
        already_finalized = _cleanupDoubleSpendingStandardExits(inputUtxoPos, _inputTx);

        return (input, inputUtxoPos, already_finalized);
    }

    /**
     * @dev Processes a standard exit.
     * @param _standardExit Exit to process.
     */
    function _processStandardExit(Exit storage _standardExit, uint192 exitId)
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

            // Only delete the owner so someone can't exit from the same output twice.
            delete _standardExit.owner;
            // Delete token too, since check is done by amount anyway.
            delete _standardExit.token;

            emit ExitFinalized(exitId);
        }
    }

    /**
     * @dev Processes an in-flight exit.
     * @param _inFlightExit Exit to process.
     * @param _inFlightExitId Id of the exit process
     * @param _token Token from which exits are to be processed
     */
    function _processInFlightExit(InFlightExit storage _inFlightExit, uint192 _inFlightExitId, address _token)
        internal
    {
        // Determine whether the inputs or the outputs are the exitable set.
        bool inputsExitable = isInputExit(_inFlightExit);
        // Process the inputs or outputs.
        PlasmaCore.TransactionOutput memory output;
        uint256 ethTransferAmount;
        for (uint8 i = 0; i < 8; i++) {
            if (i < MAX_INPUTS) {
                output = _inFlightExit.inputs[i];
            } else {
                output = _inFlightExit.outputs[i - MAX_INPUTS];
            }

            // Check if the output's token or the "to exit" bit is not set.
            if (output.token != _token || !isPiggybacked(_inFlightExit, i)) {
                continue;
            }
            // Set bit flag to prevent future exits by standard exit mechanism.
            setExited(_inFlightExit, i);


            // Pay out any unchallenged and exitable inputs or outputs, refund the rest.
            ethTransferAmount = piggybackBond;
            if ((i < MAX_INPUTS && inputsExitable) || (i >= MAX_INPUTS && !inputsExitable)) {

                if (_token == address(0)) {
                    ethTransferAmount += output.amount;
                }
                else {
                    require(ERC20(_token).transfer(output.owner, output.amount));
                }
                emit InFlightExitFinalized(_inFlightExitId, i);
            }
            output.owner.transfer(ethTransferAmount);
        }

        if (_shouldClearInFlightExit(_inFlightExit)) {
            _clearInFlightExit(_inFlightExit);
        }
    }

    function _shouldClearInFlightExit(InFlightExit storage _inFlightExit)
        internal
        returns (bool)
    {
        for (uint8 i  = 0; i < MAX_INPUTS * 2; ++i) {
            // Check if any output is still piggybacked and awaits processing
            if (isPiggybacked(_inFlightExit, i)) {
                return false;
            }
        }
        return true;
    }

    function _clearInFlightExit(InFlightExit storage _inFlightExit)
        internal
    {
        // Refund the current bond owner.
        _inFlightExit.bondOwner.transfer(inFlightExitBond);

        // Flag as finalized
        setFinalized(_inFlightExit);

        // Delete everything but the exit map to block exits from already processed outputs.
        delete _inFlightExit.exitStartTimestamp;
        delete _inFlightExit.exitPriority;
        delete _inFlightExit.inputs;
        delete _inFlightExit.outputs;
        delete _inFlightExit.bondOwner;
        delete _inFlightExit.oldestCompetitor;
    }

    function _isDeposit(uint256 blknum)
        internal
        returns (bool)
    {
        return blknum % CHILD_BLOCK_INTERVAL != 0;
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
