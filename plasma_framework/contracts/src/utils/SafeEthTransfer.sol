pragma solidity 0.5.11;

/**
* @notice Utility library to safely transfer ETH
* @dev transfer is no longer the recommended way to do ETH transfer.
*      see issue: https://github.com/omisego/plasma-contracts/issues/312
*
*      This library limits the amount of gas used for external calls with value to protect against potential DOS/griefing attacks that try use up all the gas.
*      see issue: https://github.com/omisego/plasma-contracts/issues/385
*/
library SafeEthTransfer {
    /**
     * @notice Try to transfer eth without using more gas than `gasStipend`.
     *         Reverts if it fails to transfer the ETH.
     * @param receiver the address to receive Eth
     * @param amount the amount of ETH (in wei) to transfer
     * @param gasStipend the maximum amount of gas to be used for the call
     */
    function transferRevertOnError(address payable receiver, uint256 amount, uint256 gasStipend)
        internal
    {
        bool success = transferReturnResult(receiver, amount, gasStipend);
        require(success, "SafeEthTransfer: failed to transfer ETH");
    }

    /**
     * @notice Transfer ETH without using more gas than the `gasStipend`.
     *         Returns whether the transfer call is successful or not.
     * @dev EVM will revert with "out of gas" error if there is not enough gas left for the call
     * @param receiver the address to receive ETH
     * @param amount the amount of ETH (in wei) to transfer
     * @param gasStipend the maximum amount of gas to be used during the transfer call
     * @return a flag showing the call is successful or not
     */
    function transferReturnResult(address payable receiver, uint256 amount, uint256 gasStipend)
        internal
        returns (bool)
    {
        (bool success, ) = receiver.call.gas(gasStipend).value(amount)("");
        return success;
    }
}
