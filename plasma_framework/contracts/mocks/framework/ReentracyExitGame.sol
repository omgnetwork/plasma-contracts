pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./registries/ExitGameRegistryMock.sol";
import "../../src/framework/ExitGameController.sol";
import "../../src/framework/interfaces/IExitProcessor.sol";
import "../../src/vaults/Erc20Vault.sol";
import "../../src/vaults/EthVault.sol";
import "../../src/utils/TxPosLib.sol";

contract ReentrancyExitGame is IExitProcessor {

    // we use a single exit processing queue
    uint256 constant public EXIT_FUNDING_VAULT_ID = 1;

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
    function processExit(uint160, address) public {
        exitGameController.processExits(EXIT_FUNDING_VAULT_ID, testToken, 0, reentryMaxExitToProcess);
    }

    function enqueue(uint256 _vaultId, address _token, uint64 _exitableAt, uint256 _txPos, uint160 _exitId, IExitProcessor _exitProcessor)
        public
    {
        exitGameController.enqueue(_vaultId, _token, _exitableAt, TxPosLib.TxPos(_txPos), _exitId, _exitProcessor);
    }
}
