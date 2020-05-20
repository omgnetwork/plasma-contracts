pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/framework/ExitGameController.sol";
import "../../src/framework/interfaces/IExitProcessor.sol";

contract ReentrancyExitGame is IExitProcessor {
    ExitGameController public exitGameController;
    uint256 public vaultId;
    address public testToken;
    uint256 public reentryMaxExitToProcess;

    constructor(ExitGameController _controller, uint256 _vaultId, address _token, uint256 _reentryMaxExitToProcess) public {
        exitGameController = _controller;
        vaultId = _vaultId;
        testToken = _token;
        reentryMaxExitToProcess = _reentryMaxExitToProcess;
    }

    // override ExitProcessor interface
    // This would call the processExits back to mimic reentracy attack
    function processExit(uint168, uint256, address) public {
        exitGameController.processExits(vaultId, testToken, 0, reentryMaxExitToProcess);
    }

    function enqueue(uint256 _vaultId, address _token, uint64 _exitableAt, uint256 _txPos, uint168 _exitId, IExitProcessor _exitProcessor)
        public
    {
        exitGameController.enqueue(_vaultId, _token, _exitableAt, PosLib.decode(_txPos), _exitId, _exitProcessor);
    }
}
