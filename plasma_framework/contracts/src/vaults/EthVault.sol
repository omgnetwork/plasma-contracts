pragma solidity ^0.5.0;

import "./Vault.sol";
import "./ZeroHashesProvider.sol";
import "../framework/BlockController.sol";
import {PaymentTransactionModel as DepositTx} from "../transactions/PaymentTransactionModel.sol";

contract EthVault is Vault {
    uint8 constant DEPOSIT_TX_TYPE = 1;

    bytes32[16] zeroHashes;

    constructor(address _blockController) public {
        blockController = BlockController(_blockController);
        zeroHashes = ZeroHashesProvider.getZeroHashes();
    }

    /**
     * @notice Allows a user to submit a deposit.
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

    function _validateDepositFormat(DepositTx.Transaction memory _deposit) private {
        require(_deposit.txType == DEPOSIT_TX_TYPE, "Invalid transaction type");

        require(_deposit.inputs.length == 1, "Deposit should have exactly one input");
        require(_deposit.inputs[0] == bytes32(0), "Deposit input must be bytes32 of 0");

        require(_deposit.outputs.length == 1, "Must have only one output");
        require(_deposit.outputs[0].amount == msg.value, "Deposited value does not match sent amount");
        require(_deposit.outputs[0].token == address(0), "Output does not have correct currency (ETH)");

        address depositorsAddress = address(uint160(uint256(_deposit.outputs[0].outputGuard)));
        require(depositorsAddress == msg.sender, "Depositor's address does not match sender's address");
    }

    /**
    * @notice Withdraw plasma chain eth via transferring ETH.
    * @param _target Place to transfer eth.
    * @param _amount Amount of eth to transfer.
    */
    function withdraw(address payable _target, uint256 _amount) external onlyFromExitGame {
        _target.transfer(_amount);
    }
}
