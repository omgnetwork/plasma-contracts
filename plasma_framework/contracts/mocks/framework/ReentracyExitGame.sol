pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "./registries/ExitGameRegistryMock.sol";
import "../../src/framework/ExitGameController.sol";
import "../../src/framework/interfaces/IExitProcessor.sol";
import "../../src/vaults/Erc20Vault.sol";
import "../../src/vaults/EthVault.sol";
import "../../src/utils/TxPosLib.sol";

contract ReentrancyExitGame is IExitProcessor {
    ExitGameController public exitGameController;
    address public testToken;
    uint256 public reentryMaxExitToProcess;

    constructor(ExitGameController _controller, address _token, uint256 _reentryMaxExitToProcess) public {
        exitGameController = _controller;
        testToken = _token;
        reentryMaxExitToProcess = _reentryMaxExitToProcess;
    }

    // override ExitProcessor interface
    // This would call the processExits back to mimic reentracy attack
    function processExit(uint192, address) public {
        exitGameController.processExits(testToken, 0, reentryMaxExitToProcess);
    }

    function enqueue(address _token, uint64 _exitableAt, uint256 _txPos, uint192 _exitId, IExitProcessor _exitProcessor) public {
        exitGameController.enqueue(_token, _exitableAt, TxPosLib.TxPos(_txPos), _exitId, _exitProcessor);
    }
}
