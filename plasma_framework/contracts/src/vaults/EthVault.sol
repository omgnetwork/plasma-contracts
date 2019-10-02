pragma solidity 0.5.11;

import "./Vault.sol";
import "./verifiers/IEthDepositVerifier.sol";
import "../framework/PlasmaFramework.sol";

contract EthVault is Vault {
    event EthWithdrawn(
        address payable indexed target,
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
     * @notice Allows a user to submit a deposit.
     * @param _depositTx RLP encoded transaction to act as the deposit.
     */
    function deposit(bytes calldata _depositTx) external payable {
        IEthDepositVerifier(getEffectiveDepositVerifier()).verify(_depositTx, msg.value, msg.sender);
        uint256 blknum = super._submitDepositBlock(_depositTx);

        emit DepositCreated(msg.sender, blknum, address(0), msg.value);
    }

    /**
    * @notice Withdraw plasma chain eth via transferring ETH.
    * @param _target Place to transfer eth.
    * @param _amount Amount of eth to transfer.
    */
    function withdraw(address payable _target, uint256 _amount) external onlyFromNonQuarantinedExitGame {
        _target.transfer(_amount);
        emit EthWithdrawn(_target, _amount);
    }
}
