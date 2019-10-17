pragma solidity 0.5.11;

import "./Vault.sol";
import "./verifiers/IEthDepositVerifier.sol";
import "../framework/PlasmaFramework.sol";

contract EthVault is Vault {
    uint256 private withdrawEntryCounter = 0;

    event EthWithdrawn(
        address indexed receiver,
        uint256 amount
    );

    event WithdrawFailed(
        address indexed receiver,
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
     * @notice Allows a user to deposit ETH into the contract.
     * Once the deposit is recognized, the owner is able to make transactions on the OMG network.
     * @param _depositTx RLP encoded transaction to act as the deposit.
     */
    function deposit(bytes calldata _depositTx) external payable {
        IEthDepositVerifier(getEffectiveDepositVerifier()).verify(_depositTx, msg.value, msg.sender);
        uint256 blknum = super._submitDepositBlock(_depositTx);

        emit DepositCreated(msg.sender, blknum, address(0), msg.value);
    }

    /**
    * @notice Withdraw ETH that have been exited from the OMG network successfully.
    * @param receiver address of the transferee
    * @param amount amount of eth to transfer.
    */
    function withdraw(address payable receiver, uint256 amount) external onlyFromNonQuarantinedExitGame {
        // we do not want to block exit queue if transfer is unucessful
        // solhint-disable-next-line avoid-call-value
        (bool success, ) = receiver.call.value(amount)("");
        if (success) {
            emit EthWithdrawn(receiver, amount);
        } else {
            emit WithdrawFailed(receiver, amount);
        }
    }
}
