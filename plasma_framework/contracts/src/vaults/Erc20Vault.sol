pragma solidity 0.5.11;

import "./Vault.sol";
import "./verifiers/IErc20DepositVerifier.sol";
import "../framework/PlasmaFramework.sol";
import "../utils/GracefulReentrancyGuard.sol";

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";

contract Erc20Vault is Vault, GracefulReentrancyGuard {
    using SafeERC20 for IERC20;

    event Erc20Withdrawn(
        address indexed receiver,
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
     * @notice Deposits approved amount of ERC20 token(s) into the contract.
     * Once the deposit is recognized, the owner (depositor) is able to make transactions on the OMG network.
     * The approve function of the ERC20 token contract needs to be called before this function is called
     * for at least the amount that is deposited into the contract.
     * @param depositTx RLP encoded transaction to act as the deposit.
     */
    function deposit(bytes calldata depositTx) external {
        (address depositor, address token, uint256 amount) = IErc20DepositVerifier(getEffectiveDepositVerifier())
            .verify(depositTx, msg.sender, address(this));

        IERC20(token).safeTransferFrom(depositor, address(this), amount);

        uint256 blknum = super._submitDepositBlock(depositTx);

        emit DepositCreated(msg.sender, blknum, token, amount);
    }

    /**
    * @notice Withdraw ERC20 tokens that have been exited from the OMG network successfully.
    * @param receiver address of the receiver
    * @param token address of ERC20 token contract.
    * @param amount amount to transfer.
    */
    function withdraw(address payable receiver, address token, uint256 amount) external onlyFromNonQuarantinedExitGame gracefullyNonReentrant {
        IERC20(token).safeTransfer(receiver, amount);
        emit Erc20Withdrawn(receiver, token, amount);
    }
}
