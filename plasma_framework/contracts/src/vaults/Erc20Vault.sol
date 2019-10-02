pragma solidity 0.5.11;

import "./Vault.sol";
import "./verifiers/IErc20DepositVerifier.sol";
import "../framework/PlasmaFramework.sol";

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";

contract Erc20Vault is Vault {
    using SafeERC20 for IERC20;

    event Erc20Withdrawn(
        address payable indexed target,
        address indexed token,
        uint256 amount
    );

    event DepositCreated(
        address indexed depositor,
        uint256 indexed blknum,
        address indexed token,
        uint256 amount
    );

    constructor(PlasmaFramework _framework) public Vault(_framework) {}

    /**
     * @notice Deposits approved amount of ERC20 token. Approve must have been called first.
     * @param _depositTx RLP encoded transaction to act as the deposit.
     */
    function deposit(bytes calldata _depositTx) external {
        (address owner, address token, uint256 amount) = IErc20DepositVerifier(getEffectiveDepositVerifier())
            .verify(_depositTx, msg.sender, address(this));

        IERC20(token).safeTransferFrom(owner, address(this), amount);

        uint256 blknum = super._submitDepositBlock(_depositTx);

        emit DepositCreated(msg.sender, blknum, token, amount);
    }

    /**
    * @notice Withdraw plasma chain ERC20 tokens to target
    * @param _target Place to transfer eth.
    * @param _token Address of ERC20 token contract.
    * @param _amount Amount to transfer.
    */
    function withdraw(address payable _target, address _token, uint256 _amount) external onlyFromNonQuarantinedExitGame {
        IERC20(_token).safeTransfer(_target, _amount);
        emit Erc20Withdrawn(_target, _token, _amount);
    }
}
