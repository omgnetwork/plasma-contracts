pragma solidity 0.5.11;

import "../../src/utils/SafeEthTransfer.sol";

contract SafeEthTransferMock {
    bool public transferResult;

    function transferRevertOnError(address payable receiver, uint256 amount, uint256 gasStipend)
        public
    {
        SafeEthTransfer.transferRevertOnError(receiver, amount, gasStipend);
    }

    function transferReturnResult(address payable receiver, uint256 amount, uint256 gasStipend)
        public
    {
        transferResult = SafeEthTransfer.transferReturnResult(receiver, amount, gasStipend);
    }

    /** helper function to pre-fund the contract to test */
    function setupInitialFundToTestTransfer() external payable {}
}
