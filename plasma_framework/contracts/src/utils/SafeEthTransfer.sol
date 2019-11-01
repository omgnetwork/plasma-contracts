pragma solidity 0.5.11;

/**
* @notice Util library to safe transfer ETH
* @dev transfer is no longer the recommended way to do ETH transfer.
*      see issue: https://github.com/omisego/plasma-contracts/issues/312
*
*      This library add extra protection on gas to protect potential DOS/griefing attack by bruning gas.
*      see issue: https://github.com/omisego/plasma-contracts/issues/385
*/
library SafeEthTransfer {
    /**
     * @notice Safe transfers eth within the gas limit, reverts if failed
     * @param receiver the address to receive Eth
     * @param amount the amount of Eth to transfer
     * @param gasStipend the amount of gas to be used during the transfer call
     */
    function transfer(address payable receiver, uint256 amount, uint256 gasStipend)
        internal
    {
        bool success = callTransfer(receiver, amount, gasStipend);
        require(success, "SafeEthTransfer: failed to transfer ETH");
    }

    /**
     * @notice Try to transfer eth within the gas limit, returns successful or not
     * @param receiver the address to receive Eth
     * @param amount the amount of Eth to transfer
     * @param gasStipend the amount of gas to be used during the transfer call
     * @return a flag showing the call is successful or not
     */
    function callTransfer(address payable receiver, uint256 amount, uint256 gasStipend)
        internal
        returns (bool)
    {
        (bool success, ) = receiver.call.gas(gasStipend).value(amount)("");
        return success;
    }
}
