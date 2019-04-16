pragma solidity ^0.5.0;

contract PlasmaWallet {
    /**
     * @dev Allows anyone to add new token to Plasma chain
     * @param _token The address of the ERC20 token
     */
    function addToken(address _token) external;

    /**
     * @dev Allows a user to submit a deposit.
     * @param _depositTx RLP encoded transaction to act as the deposit.
     */
    function deposit(bytes calldata _depositTx) external payable;

    /**
     * @dev Deposits approved amount of ERC20 token. Approve must be called first. Note: does not check if token was added.
     * @param _depositTx RLP encoded transaction to act as the deposit.
     */
    function depositFrom(bytes calldata _depositTx) external;

    /**
     * @dev Withdraw plasma chain eth via transfering ETH.
     * @param _target Place to transfer eth.
     * @param _amount Amount of eth to transfer.
     */
    function withdrawEth(address _target, uint256 _amount) external;

    /**
     * @dev Withdraw plasma chain ERC20 token via ERC20 transfer.
     * @param _token ERC20 token type.
     * @param _target Place to transfer eth.
     * @param _amount Amount of eth to transfer.
     */
    function withdrawErc20(address _token, address _target, uint256 _amount) external;
}