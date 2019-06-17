pragma solidity ^0.5.0;

import "./Vault.sol";
import "./ZeroHashesProvider.sol";
import "../framework/BlockController.sol";
import {TransactionModel as DepositTx} from "../transactions/TransactionModel.sol";

contract EthVault is Vault {
    uint8 constant DEPOSIT_TX_TYPE = 1;

    bytes32[16] zeroHashes;

    using DepositTx for DepositTx.Transaction;

    constructor(address _blockController) public {
        blockController = BlockController(_blockController);
        zeroHashes = ZeroHashesProvider.getZeroHashes();
    }

    /**
     * @dev Allows a user to submit a deposit.
     * @param _depositTx RLP encoded transaction to act as the deposit.
     */
    function deposit(bytes calldata _depositTx) external payable {
        DepositTx.Transaction memory decodedTx = DepositTx.decode(_depositTx);

        _validateDepositFormat(decodedTx);

        bytes32 root = keccak256(_depositTx);
        for (uint i = 0; i < 16; i++) {
            root = keccak256(abi.encodePacked(root, zeroHashes[i]));
        }

        blockController.submitDepositBlock(root);
    }

    function _validateDepositFormat(DepositTx.Transaction memory deposit) private {
        require(deposit.txType == DEPOSIT_TX_TYPE, "Invalid transaction type");

        //Deposit has one input and it's id is 0
        require(deposit.inputs.length == 1, "Invalid number of inputs");
        require(deposit.inputs[0] == bytes32(0), "Deposit input must be bytes32 of 0");

        require(deposit.outputs.length == 1, "Invalid number of outputs");
        require(deposit.outputs[0].amount == msg.value, "Deposited value does not match sent amount");
        require(deposit.outputs[0].token == address(0), "Output does not have correct currency (ETH)");

        address depositorsAddress = address(uint160(uint256(deposit.outputs[0].outputGuard)));
        require(depositorsAddress == msg.sender, "Depositors address does not match senders address");
    }

    /**
    * @dev Withdraw plasma chain eth via transferring ETH.
    * @param _target Place to transfer eth.
    * @param _amount Amount of eth to transfer.
    */
    function withdraw(address payable _target, uint256 _amount) external onlyFromExitProcessor {
        _target.transfer(_amount);
    }
}
