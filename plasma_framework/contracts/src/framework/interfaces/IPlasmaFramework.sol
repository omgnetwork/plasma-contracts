pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../models/ExitModel.sol";


interface IPlasmaFramework {
    function CHILD_BLOCK_INTERVAL() external view returns (uint256);

    function minExitPeriod() external view returns (uint256);

    function blocks(uint256 _blockNumber) external view returns (bytes32, uint256);

    function enqueue(uint192 _priority, address _token, ExitModel.Exit calldata _exit) external returns (uint256);

    function isOutputSpent(bytes32 _outputId) external view returns (bool);

    function flagOutputSpent(bytes32 _outputId) external;

    function submitDepositBlock(bytes32 _blockRoot) external;

    function exitGameToTxType(address _exitGame) external view returns (uint256);
}
