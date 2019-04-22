pragma solidity ^0.5.0;
// Should be safe to use. It is marked as experimental as it costs higher gas usage.
// see: https://github.com/ethereum/solidity/issues/5397 
pragma experimental ABIEncoderV2;

import "./ExitModel.sol";

interface ExitGame {
    /**
     * @dev Check the result of exit game, whether an exit is able to process or not (is successfully challenged or not).
     * @param _exitId Unique identifier of exit within the exit game.
     */
    function isExitValid(bytes32 _exitId) external view returns (bool);

    /**
     * @dev Custom function to proces exit.
     * @param _exit Exit data.
     */
    function processExit(ExitModel.Exit calldata _exit) external;
}