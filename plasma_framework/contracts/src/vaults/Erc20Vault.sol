pragma solidity ^0.5.0;

import "./Vault.sol";
import "./predicates/IErc20DepositVerifier.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";

contract Erc20Vault is Vault {
    IErc20DepositVerifier private _depositVerifier;

    using SafeERC20 for IERC20;

    constructor(address _blockController) Vault(_blockController) public {}

    /**
     * @notice Set the deposit verifier contract. This can be only called by the operator.
     * @param _contract address of the verifier contract.
     */
    function setDepositVerifier(address _contract) public onlyOperator {
        _depositVerifier = IErc20DepositVerifier(_contract);
    }

    /**
     * @notice Deposits approved amount of ERC20 token. Approve must have been called first.
     * @param _depositTx RLP encoded transaction to act as the deposit.
     */
    function deposit(bytes calldata _depositTx) external {
        (address owner, address token, uint256 amount) = _depositVerifier.verify(_depositTx, msg.sender, address(this));

        IERC20(token).safeTransferFrom(owner, address(this), amount);

        super._submitDepositBlock(_depositTx);
    }

    /**
    * @notice Withdraw plasma chain ERC20 tokens to target
    * @param _target Place to transfer eth.
    * @param _token Address of ERC20 token contract.
    * @param _amount Amount to transfer.
    */
    function withdraw(address _target, address _token, uint256 _amount) external onlyFromExitGame {
        IERC20(_token).safeTransfer(_target, _amount);
    }
}
