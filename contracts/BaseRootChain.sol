pragma solidity ^0.4.0;

import "./Merkle.sol";
import "./PriorityQueue.sol";
import "./PlasmaCore.sol";

contract BaseRootChain {
    using PlasmaCore for bytes;
    using PlasmaCore for uint256;

    /*
     * Storage
     */

    address public operator;

    mapping (uint256 => Block) public blocks;
    mapping (uint256 => Exit) public exits;

    PriorityQueue exitQueue;

    struct Block {
        bytes32 root;
        uint256 timestamp;
    }

    struct Exit {
        address owner;
        uint256 amount;
    }


    /*
     * Events
     */
    
    event BlockSubmitted(
        uint256 number,
        bytes32 root
    );

    event DepositCreated(
        address indexed depositor,
        uint256 amount
    );

    event ExitStarted(
        address indexed owner,
        uint256 outputId,
        uint256 amount
    );

    event ExitBlocked(
        address indexed challenger,
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
     * Internal functions
     */

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
}
