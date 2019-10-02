pragma solidity 0.5.11;

interface IEthDepositVerifier {
    /**
     * @notice Verifies a deposit transaction.
     * @param _depositTx The deposit transaction.
     * @param _amount The amount being of the deposited.
     * @param _sender The owner of the deposit transaction.
     */
    function verify(bytes calldata _depositTx, uint256 _amount, address _sender) external view;
}
