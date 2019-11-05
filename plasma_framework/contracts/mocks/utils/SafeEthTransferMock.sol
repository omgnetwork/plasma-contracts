pragma solidity 0.5.11;

import "../../src/utils/SafeEthTransfer.sol";

contract SafeEthTransferMock {
    bool public callTransferResult;

    function transfer(address payable receiver, uint256 amount, uint256 gasStipend)
        public    
    {
        SafeEthTransfer.transfer(receiver, amount, gasStipend);
    }

    function callTransfer(address payable receiver, uint256 amount, uint256 gasStipend)
        public
    {
        callTransferResult = SafeEthTransfer.callTransfer(receiver, amount, gasStipend);
    }

    /** helper function to pre-fund the contract to test */
    function setupInitialFundToTestTransfer() external payable {}
}
