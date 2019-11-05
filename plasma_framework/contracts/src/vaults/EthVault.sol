pragma solidity 0.5.11;

import "./Vault.sol";
import "./verifiers/IEthDepositVerifier.sol";
import "../framework/PlasmaFramework.sol";
import "../utils/SafeEthTransfer.sol";

contract EthVault is Vault {
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

    uint256 public safeGasStipend;

    constructor(PlasmaFramework _framework, uint256 _safeGasStipend) public Vault(_framework) {
        safeGasStipend = _safeGasStipend;
    }

    /**
     * @notice Allows a user to deposit ETH into the contract
     * Once the deposit is recognized, the owner may transact on the OmiseGO Network
     * @param _depositTx RLP-encoded transaction to act as the deposit
     */
    function deposit(bytes calldata _depositTx) external payable {
        address depositVerifier = super.getEffectiveDepositVerifier();
        require(depositVerifier != address(0), "Deposit verifier has not been set");

        IEthDepositVerifier(depositVerifier).verify(_depositTx, msg.value, msg.sender);
        uint256 blknum = super._submitDepositBlock(_depositTx);

        emit DepositCreated(msg.sender, blknum, address(0), msg.value);
    }

    /**
    * @notice Withdraw ETH that has successfully exited from the OmiseGO Network
    * @param receiver Address of the recipient
    * @param amount The amount of ETH to transfer
    */
    function withdraw(address payable receiver, uint256 amount) external onlyFromNonQuarantinedExitGame {
        // we do not want to block exit queue if transfer is unsuccessful
        bool success = SafeEthTransfer.callTransfer(receiver, amount, safeGasStipend);
        if (success) {
            emit EthWithdrawn(receiver, amount);
        } else {
            emit WithdrawFailed(receiver, amount);
        }
    }
}
