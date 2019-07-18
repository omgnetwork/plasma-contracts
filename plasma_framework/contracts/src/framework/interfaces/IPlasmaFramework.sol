pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../models/ExitModel.sol";


interface IPlasmaFramework {
    function CHILD_BLOCK_INTERVAL() external view returns (uint256);

    function minExitPeriod() external view returns (uint256);

    function blocks(uint256 _blockNumber) external view returns (bytes32, uint256);

    function enqueue(address _token, ExitModel.Exit calldata _exit) external returns (uint256);
}
