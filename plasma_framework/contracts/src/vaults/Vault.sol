pragma solidity ^0.5.0;

import "./ZeroHashesProvider.sol";
import "../framework/BlockController.sol";
import {PaymentTransactionModel as DepositTx} from "../transactions/PaymentTransactionModel.sol";

contract Vault {
    uint8 constant DEPOSIT_TX_TYPE = 1;

    BlockController blockController;
    bytes32[16] zeroHashes;

    constructor(address _blockController) public {
        blockController = BlockController(_blockController);
        zeroHashes = ZeroHashesProvider.getZeroHashes();
    }

    modifier onlyFromExitGame() {
        require(false, "TODO: Implement and test once we have exit plasma framework contract");
        _;
    }

    /**
    * @dev Validations that apply to all deposits, token specific validations should go into the token's vault.
    */
    function _validateDepositFormat(DepositTx.Transaction memory _deposit) internal view {
        require(_deposit.txType == DEPOSIT_TX_TYPE, "Invalid transaction type");

        require(_deposit.inputs.length == 1, "Deposit should have exactly one input");
        require(_deposit.inputs[0] == bytes32(0), "Deposit input must be bytes32 of 0");

        require(_deposit.outputs.length == 1, "Must have only one output");

        address depositorsAddress = address(uint160(uint256(_deposit.outputs[0].outputGuard)));
        require(depositorsAddress == msg.sender, "Depositor's address does not match sender's address");
    }

    function _submitDepositBlock(bytes memory _depositTx) internal {
        bytes32 root = keccak256(_depositTx);
        for (uint i = 0; i < 16; i++) {
            root = keccak256(abi.encodePacked(root, zeroHashes[i]));
        }

        blockController.submitDepositBlock(root);
    }

}
