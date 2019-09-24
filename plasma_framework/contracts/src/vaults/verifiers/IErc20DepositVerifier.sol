pragma solidity 0.5.11;

interface IErc20DepositVerifier {
    /**
     * @notice Verifies a deposit transaction.
     * @param _depositTx The deposit transaction.
     * @param _sender The owner of the deposit transaction.
     * @param _vault The address of the Erc20Vault contract.
     */
    function verify(bytes calldata _depositTx, address _sender, address _vault)
        external
        view
        returns (address owner, address token, uint256 amount);
}
