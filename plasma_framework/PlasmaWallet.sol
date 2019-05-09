pragma solidity ^0.4.0;

import "./PlasmaCore.sol";
import "./PlasmaBlockController.sol";

contract PlasmaWallet is PlasmaBlockController {
    using PlasmaCore for bytes;

    /*
     * Constants
     */
    uint8 constant public MAX_INPUTS = 4; // TODO: move (probably to a predicate)

    /*
     * Storage
     */
    bytes32[16] zeroHashes;


    /*
     * Events
     */

    event TokenAdded(
        address token
    );

    event DepositCreated(
        address indexed depositor,
        uint256 indexed blknum,
        address indexed token,
        uint256 amount
    );

    /*
     * Modifiers
     */


    /*
     * API
     */

    constructor() {
        bytes32 zeroHash = keccak256(abi.encodePacked(uint256(0)));
        for (uint i = 0; i < 16; i++) {
            zeroHashes[i] = zeroHash;
            zeroHash = keccak256(abi.encodePacked(zeroHash, zeroHash));
        }
    }

    // TODO: tokens support
//    /**
//     * @dev Allows anyone to add new token to Plasma chain
//     * @param _token The address of the ERC20 token
//     */
//    function addToken(address _token)
//        external
//    {
//        require(!hasToken(_token));
//        exitsQueues[_token] = PriorityQueueFactory.deploy(this);
//        emit TokenAdded(_token);
//    }

    /**
     * @dev Allows a user to submit a deposit.
     * @param _depositTx RLP encoded transaction to act as the deposit.
     */
    function deposit(bytes _depositTx)
        external payable
    {
        //TODO: probably we should call a predicate instead of checks
        //TODO: refactor to use predicates

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
//     * @dev Deposits approved amount of ERC20 token. Approve must be called first. Note: does not check if token was added.
//     * @param _depositTx RLP encoded transaction to act as the deposit.
//     */
    //    function depositFrom(bytes _depositTx)
    //        external
    //    {
    //        // Only allow up to CHILD_BLOCK_INTERVAL deposits per child block.
    //        require(nextDepositBlock < CHILD_BLOCK_INTERVAL);
    //
    //        // Decode the transaction.
    //        PlasmaCore.Transaction memory decodedTx = _depositTx.decode();
    //
    //        // Warning, check your ERC20 implementation. TransferFrom should return bool
    //        require(ERC20(decodedTx.outputs[0].token).transferFrom(msg.sender, address(this), decodedTx.outputs[0].amount));
    //
    //        // Perform other checks and create a deposit block.
    //        _processDeposit(_depositTx, decodedTx);
    //    }

    //    /**
    //     * @dev Withdraw plasma chain eth via transferring ETH.
    //     * @param _target Place to transfer eth.
    //     * @param _amount Amount of eth to transfer.
    //     */
    //    function withdraw(address _target, uint256 _amount) internal {
    //
    //    }
    //
    //    /**
    //     * @dev Withdraw plasma chain ERC20 token via ERC20 transfer.
    //     * @param _token ERC20 token type.
    //     * @param _target Place to transfer eth.
    //     * @param _amount Amount of eth to transfer.
    //     */
    //    function withdrawErc20(address _token, address _target, uint256 _amount) external;
    //

    /*
     * Views
     */

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


    /*
     * Private
     */

    function _processDeposit(bytes _depositTx, PlasmaCore.Transaction memory decodedTx)
        private
    {
        // Following check is needed since _processDeposit
        // can be called on stack unwinding during re-entrance attack,
        // with nextDepositBlock == 999, producing
        // deposit with blknum ending with 000.
        require(nextDepositBlock < CHILD_BLOCK_INTERVAL);

        //TODO: use predicates (?)
        for (uint i = 0; i < MAX_INPUTS; i++) {
            // all inputs should be empty
            require(decodedTx.inputs[i].blknum == 0);

            // only first output should have value
            if (i >= 1) {
                require(decodedTx.outputs[i].amount == 0);
            }
        }

        // Calculate the block root.
        bytes32 root = keccak256(_depositTx);
        for (i = 0; i < 16; i++) {
            root = keccak256(abi.encodePacked(root, zeroHashes[i]));
        }

        // Insert the deposit block.
        uint256 blknum = getDepositBlockNumber();
        blocks[blknum] = Block({
            root : root,
            timestamp : block.timestamp
            });

        emit DepositCreated(
            decodedTx.outputs[0].owner,
            blknum,
            decodedTx.outputs[0].token,
            decodedTx.outputs[0].amount
        );

        nextDepositBlock++;
    }
}