pragma solidity ^0.5.0;

import "./ZeroHashesProvider.sol";
import "../framework/PlasmaFramework.sol";
import {TransactionModel as DepositTx} from "../transactions/TransactionModel.sol";
import {IERC20 as IERC20} from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import {SafeERC20 as SafeERC20} from "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";

contract Erc20Vault {
    uint8 constant DEPOSIT_TX_TYPE = 1;

    PlasmaFramework framework;
    bytes32[16] zeroHashes;

    using DepositTx for DepositTx.Transaction;
    using SafeERC20 for IERC20;

    constructor(address _framework) public {
        framework = PlasmaFramework(_framework);
        zeroHashes = ZeroHashesProvider.getZeroHashes();
    }

    /**
     * @dev Deposits approved amount of ERC20 token. Approve must be called first.
     * @param _depositTx RLP encoded transaction to act as the deposit.
     */
    function deposit(bytes calldata _depositTx) external {
        DepositTx.Transaction memory decodedTx = DepositTx.decode(_depositTx);

        _validateDepositFormat(decodedTx);

        IERC20 erc20 = IERC20(decodedTx.outputs[0].token);

        // Check approved
        require(erc20.allowance(msg.sender, address(this)) == decodedTx.outputs[0].amount, "Tokens have not been approved");

        erc20.safeTransferFrom(msg.sender, address(this), decodedTx.outputs[0].amount);

        bytes32 root = keccak256(_depositTx);
        for (uint i = 0; i < 16; i++) {
            root = keccak256(abi.encodePacked(root, zeroHashes[i]));
        }

        framework.submitDepositBlock(root);
    }

    function _validateDepositFormat(DepositTx.Transaction memory depositTx) private {
      require(depositTx.txType == DEPOSIT_TX_TYPE, "Invalid transaction type");

      // Deposit has one input and its id is 0
      require(depositTx.inputs.length == 1, "Invalid number of inputs");
      require(depositTx.inputs[0] == bytes32(0), "Invalid input format");

      require(depositTx.outputs.length == 1, "Invalid number of outputs");
      require(depositTx.outputs[0].token != address(0), "Invalid output currency (0x0)");

      address depositorsAddress = address(uint160(uint256(depositTx.outputs[0].outputGuard)));
      require(depositorsAddress == msg.sender, "Depositors address does not match senders address");
    }

    //TODO: must be called only from exit processors, should be guarded by modifier
    /**
    * @dev Withdraw erc20 tokens to target
    * @param _target Place to transfer eth.
    * @param _token Address of erc20 token contract.
    * @param _amount Amount to transfer.
    */
    function withdraw(address _target, address _token, uint256 _amount) external {
        IERC20(_token).safeTransfer(_target, _amount);
    }
}
